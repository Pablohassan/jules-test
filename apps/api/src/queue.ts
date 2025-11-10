import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import prismaPkg from '@prisma/client';
const { PrismaClient } = prismaPkg as typeof import('@prisma/client');
import { searchArticles } from '@/services/search/tavily.js';
import { fetchAndRead } from '@/services/ingest/read.js';
import { summarizeArticle } from '@/services/summarize/openai.js';
import { buildMarkdown } from '@/services/gamma/markdown.js';
import { generatePresentation, ensureGammaExports, downloadAssetToBuffer } from '@/services/gamma/client.js';
import { uploadFileToDrive, uploadBufferToDrive } from '@/services/google/drive.js';
import { sendEmail } from '@/services/google/gmail.js';
import { renderUrlToPdf } from '@/services/gamma/render.js';

const prisma = new PrismaClient();
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const forceGammaDownload = (process.env.FORCE_GAMMA_API_DOWNLOAD || '').toLowerCase() === 'true';

export const orchestrationQueue = new Queue('orchestration', { connection });
export const distributionQueue = new Queue('distribution', { connection });

async function attemptDistribution(runId: string) {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) return;
  const gamma = await prisma.gammaGen.findFirst({ where: { runId } });
  if (!gamma) return;
  if (!gamma.pdfUrl) {
    try { await ensureGammaExports(gamma.generationId); } catch {}
  }
  const updatedGamma = await prisma.gammaGen.findFirst({ where: { id: gamma.id } });
  const token = await prisma.oAuthToken.findFirst({ where: { provider: 'google' } });
  if (updatedGamma?.pdfUrl && token?.refreshToken && process.env.GMAIL_SENDER && process.env.DRIVE_FOLDER_ID) {
    try {
      console.log(`[distribution] Attempting upload+email for run ${runId}`);
      const driveFile = await uploadFileToDrive(runId, updatedGamma.pdfUrl, `Veille IA - Semaine ${new Date().toISOString()}`, 'application/pdf');
      await sendEmail(runId, [process.env.GMAIL_SENDER!], 'Veille IA - Nouvelle présentation', `<p>La présentation de la semaine est disponible.</p>`, updatedGamma.pdfUrl, updatedGamma.gammaUrl!);
      await prisma.run.update({ where: { id: runId }, data: { links: { gammaUrl: updatedGamma.gammaUrl, pdfUrl: updatedGamma.pdfUrl, driveLink: driveFile?.webViewLink ?? null } } });
      console.log(`[distribution] Completed for run ${runId}`);
      return true;
    } catch (e) {
      await prisma.run.update({ where: { id: runId }, data: { error: `Distribution failed: ${(e as Error).message}` } });
      console.error(`[distribution] Failed for run ${runId}:`, e);
    }
  }
  return false;
}

interface RunJobData {
  runId: string;
  keywords: string[];
  daysBack: number;
  maxResults: number;
  gammaOptions?: {
    exportAs?: 'pdf' | 'pptx'
    textMode?: 'generate' | 'condense' | 'preserve'
    format?: 'presentation' | 'document' | 'webpage' | 'social'
    themeId?: string
    numCards?: number
    additionalInstructions?: string
    folderIds?: string[]
  }
}

new Worker('orchestration', async (job: Job<RunJobData>) => {
  const { runId, keywords, daysBack, maxResults } = job.data;

  try {
    // 1. Search
    await prisma.run.update({ where: { id: runId }, data: { status: 'RUNNING', progress: 10 } });
    const sources = await searchArticles(runId, keywords, daysBack, maxResults);
    await prisma.run.update({ where: { id: runId }, data: { counts: { sources: sources.length } } });

    // 2. Ingest
    await prisma.run.update({ where: { id: runId }, data: { progress: 20 } });
    const articles = (await Promise.all(sources.map(source => fetchAndRead(runId, source)))).filter(Boolean);
    await prisma.run.update({ where: { id: runId }, data: { counts: { sources: sources.length, articles: articles.length } } });

    // 3. Summarize
    await prisma.run.update({ where: { id: runId }, data: { progress: 40 } });
    const summaries: any[] = [];
    const concurrency = Math.max(1, Number(process.env.OPENAI_SUMMARY_CONCURRENCY || 1));
    const baseDelay = Math.max(0, Number(process.env.OPENAI_SUMMARY_BASE_DELAY_MS || 300));

    async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

    if (concurrency <= 1) {
      for (let idx = 0; idx < articles.length; idx++) {
        const article = articles[idx];
        const s = await summarizeArticle(article.id, article.textMd, {
          title: article.source?.title || undefined,
          sourceName: article.source?.siteName || undefined,
          date: article.source?.publishedAt || undefined,
        });
        if (s) summaries.push(s);
        // Update counts and progress incrementally (40%..60%)
        const partial = summaries.length;
        const frac = articles.length > 0 ? partial / articles.length : 1;
        const prog = 40 + Math.floor(frac * 20);
        await prisma.run.update({ where: { id: runId }, data: { counts: { sources: sources.length, articles: articles.length, summaries: partial }, progress: prog } });
        if (baseDelay > 0) await sleep(baseDelay);
      }
    } else {
      // Chunked parallelism if user explicitly raises concurrency
      for (let i = 0; i < articles.length; i += concurrency) {
        const chunk = articles.slice(i, i + concurrency);
        const res = await Promise.all(
          chunk.map((article) =>
            summarizeArticle(article.id, article.textMd, {
              title: article.source?.title || undefined,
              sourceName: article.source?.siteName || undefined,
              date: article.source?.publishedAt || undefined,
            })
          )
        );
        const added = res.filter(Boolean) as any[];
        summaries.push(...added);
        const partial = summaries.length;
        const frac = articles.length > 0 ? partial / articles.length : 1;
        const prog = 40 + Math.floor(frac * 20);
        await prisma.run.update({ where: { id: runId }, data: { counts: { sources: sources.length, articles: articles.length, summaries: partial }, progress: prog } });
        if (baseDelay > 0) await sleep(baseDelay);
      }
    }
    await prisma.run.update({ where: { id: runId }, data: { counts: { sources: sources.length, articles: articles.length, summaries: summaries.length } } });

    // Fetch summaries with their sources for markdown generation
    const summariesWithSource = await prisma.summary.findMany({
        where: { id: { in: summaries.map(s => s.id) } },
        include: { article: { include: { source: true } } }
    });

    // 4. Generate Presentation
    if (summariesWithSource.length === 0) {
      await prisma.run.update({ where: { id: runId }, data: { status: 'FAILED', error: 'No summaries generated (content extraction or model limits)', finishedAt: new Date(), progress: 45 } });
      return;
    }
    await prisma.run.update({ where: { id: runId }, data: { progress: 60 } });
    const markdown = buildMarkdown(summariesWithSource);
    let gammaGen: any = null;
    // Avoid duplicate generations for the same run
    const existingGamma = await prisma.gammaGen.findFirst({ where: { runId } });
    if (existingGamma && existingGamma.status === 'completed') {
      gammaGen = existingGamma;
    } else if (process.env.GAMMA_API_KEY) {
      try {
        gammaGen = await generatePresentation(runId, markdown, job.data.gammaOptions);
      } catch (e) {
        await prisma.run.update({ where: { id: runId }, data: { error: `Gamma generation failed: ${(e as Error).message}` } });
      }
    }

    // 5. Distribute
    await prisma.run.update({ where: { id: runId }, data: { progress: 80 } });
    let driveFile: any = null;
    const token = await prisma.oAuthToken.findFirst({ where: { provider: 'google' } });
    // If Gamma finished without pdfUrl, try to fetch exports now
    if (gammaGen && !gammaGen.pdfUrl) {
      try {
        const extra = await ensureGammaExports(gammaGen.generationId);
        if (extra?.pdfUrl) {
          gammaGen = await prisma.gammaGen.findFirst({ where: { id: gammaGen.id } });
        }
      } catch {}
    }
    const hasPdf = Boolean(gammaGen?.pdfUrl);
    const hasShare = Boolean(gammaGen?.gammaUrl);
    const allowHeadless = !forceGammaDownload;
    const hasDeliverable = hasPdf || (allowHeadless && hasShare);
    const canDistribute = Boolean(gammaGen && hasDeliverable && process.env.GMAIL_SENDER && process.env.DRIVE_FOLDER_ID && token && token.refreshToken);
    if (canDistribute) {
      try {
        let finalPdfUrl: string | null = gammaGen!.pdfUrl ?? null;
        let renderedBuffer: Buffer | null = null;
        if (!finalPdfUrl && allowHeadless && gammaGen?.gammaUrl) {
          // Headless render fallback
          try {
            renderedBuffer = await renderUrlToPdf(gammaGen.gammaUrl);
          } catch (e) {
            throw new Error(`Headless render failed: ${(e as Error).message}`);
          }
        }

        if (renderedBuffer) {
          driveFile = await uploadBufferToDrive(runId, renderedBuffer, `Veille IA - ${new Date().toISOString()}.pdf`, 'application/pdf');
          await sendEmail(runId, [process.env.GMAIL_SENDER!], 'Veille IA - Nouvelle présentation', `<p>La présentation de la semaine est disponible.</p>`, '', gammaGen!.gammaUrl!, renderedBuffer);
        } else if (finalPdfUrl) {
          // If the pdfUrl requires auth, download via API and upload buffer
          let buffer: Buffer | null = null;
          try {
            const apiBase = process.env.GAMMA_API_BASE || 'https://api.gamma.app';
            if (forceGammaDownload || finalPdfUrl.startsWith(apiBase) || (process.env.GAMMA_API_BASE && finalPdfUrl.startsWith(process.env.GAMMA_API_BASE))) {
              buffer = await downloadAssetToBuffer(finalPdfUrl);
            } else if (finalPdfUrl.startsWith('https://')) {
              buffer = await downloadAssetToBuffer(finalPdfUrl);
            }
          } catch {}
          if (buffer) {
            driveFile = await uploadBufferToDrive(runId, buffer, `Veille IA - ${new Date().toISOString()}.pdf`, 'application/pdf');
            await sendEmail(runId, [process.env.GMAIL_SENDER!], 'Veille IA - Nouvelle présentation', `<p>La présentation de la semaine est disponible.</p>`, '', gammaGen!.gammaUrl!, buffer);
          } else {
            driveFile = await uploadFileToDrive(runId, finalPdfUrl, `Veille IA - Semaine ${new Date().toISOString()}`, 'application/pdf');
            await sendEmail(runId, [process.env.GMAIL_SENDER!], 'Veille IA - Nouvelle présentation', `<p>La présentation de la semaine est disponible.</p>`, finalPdfUrl, gammaGen!.gammaUrl!);
          }
        } else {
          throw new Error('No PDF available and no share link to render');
        }

        await prisma.run.update({ where: { id: runId }, data: { counts: { sources: sources.length, articles: articles.length, summaries: summaries.length, gamma: 1 } } });
      } catch (e) {
        await prisma.run.update({ where: { id: runId }, data: { error: `Distribution failed: ${(e as Error).message}` } });
      }
    } else if (gammaGen && token && !token.refreshToken) {
      await prisma.run.update({ where: { id: runId }, data: { error: 'Google token lacks refresh permission. Click Connect Google again (consent+offline).' } });
    } else if (gammaGen && !gammaGen.pdfUrl) {
      // Schedule background distribution retries
      const baseDelay = Number(process.env.GAMMA_DISTRIBUTION_BASE_DELAY_MS || 60000);
      const maxAttempts = Number(process.env.GAMMA_DISTRIBUTION_MAX_ATTEMPTS || 5);
      await distributionQueue.add('distribute', { runId, attempt: 1 }, { jobId: `dist-${runId}-1`, delay: baseDelay, removeOnComplete: true });
      const msg = forceGammaDownload
        ? 'Gamma PDF not ready yet (force download enabled); distribution will retry automatically.'
        : 'Gamma PDF not ready yet; distribution will retry in the background.';
      await prisma.run.update({ where: { id: runId }, data: { error: msg } });
    }

    // Done
    await prisma.run.update({ where: { id: runId }, data: { status: 'DONE', progress: 100, finishedAt: new Date(), links: {
      gammaUrl: gammaGen?.gammaUrl ?? null,
      pdfUrl: gammaGen?.pdfUrl ?? null,
      driveLink: driveFile?.webViewLink ?? null,
    } } });

  } catch (error) {
    console.error(`Run ${runId} failed:`, error);
    await prisma.run.update({
      where: { id: runId },
      data: { status: 'FAILED', error: (error as Error).message, finishedAt: new Date() },
    });
    throw error; // Allow BullMQ to handle the job failure
  }
}, { connection });

// Background distribution worker with simple backoff
new Worker('distribution', async (job: Job<{ runId: string; attempt: number }>) => {
  const { runId, attempt } = job.data;
  console.log(`[distribution] attempt ${attempt} for run ${runId}`);
  const ok = await attemptDistribution(runId);
  if (!ok) {
    const maxAttempts = Number(process.env.GAMMA_DISTRIBUTION_MAX_ATTEMPTS || 5);
    if (attempt < maxAttempts) {
      const baseDelay = Number(process.env.GAMMA_DISTRIBUTION_BASE_DELAY_MS || 60000);
      const nextDelay = baseDelay * Math.pow(2, attempt - 1);
      await distributionQueue.add('distribute', { runId, attempt: attempt + 1 }, { jobId: `dist-${runId}-${attempt + 1}`, delay: nextDelay, removeOnComplete: true });
      console.log(`[distribution] requeued run ${runId} for attempt ${attempt + 1} in ${nextDelay}ms`);
    }
  }
}, { connection });

export async function enqueueDistributionNow(runId: string) {
  await distributionQueue.add('distribute', { runId, attempt: 1 }, { jobId: `dist-${runId}-${Date.now()}`, delay: 0, removeOnComplete: true });
  return { enqueued: true };
}
