import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { searchArticles } from '@/services/search/tavily.js';
import { fetchAndRead } from '@/services/ingest/read.js';
import { summarizeArticle } from '@/services/summarize/openai.js';
import { buildMarkdown } from '@/services/gamma/markdown.js';
import { generatePresentation } from '@/services/gamma/client.js';
import { uploadFileToDrive } from '@/services/google/drive.js';
import { sendEmail } from '@/services/google/gmail.js';

const prisma = new PrismaClient();
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const orchestrationQueue = new Queue('orchestration', { connection });

interface RunJobData {
  runId: string;
  keywords: string[];
  daysBack: number;
  maxResults: number;
}

new Worker('orchestration', async (job: Job<RunJobData>) => {
  const { runId, keywords, daysBack, maxResults } = job.data;

  try {
    // 1. Search
    await prisma.run.update({ where: { id: runId }, data: { status: 'RUNNING', progress: 10 } });
    const sources = await searchArticles(runId, keywords, daysBack, maxResults);

    // 2. Ingest
    await prisma.run.update({ where: { id: runId }, data: { progress: 20 } });
    const articles = (await Promise.all(sources.map(source => fetchAndRead(runId, source)))).filter(Boolean);

    // 3. Summarize
    await prisma.run.update({ where: { id: runId }, data: { progress: 40 } });
    const summaries = (await Promise.all(articles.map(article => summarizeArticle(article.id, article.textMd, {
      title: article.source.title || undefined,
      sourceName: article.source.siteName || undefined,
      date: article.source.publishedAt || undefined,
    })))).filter(Boolean);

    // Fetch summaries with their sources for markdown generation
    const summariesWithSource = await prisma.summary.findMany({
        where: { id: { in: summaries.map(s => s.id) } },
        include: { article: { include: { source: true } } }
    });

    // 4. Generate Presentation
    await prisma.run.update({ where: { id: runId }, data: { progress: 60 } });
    const markdown = buildMarkdown(summariesWithSource);
    const gammaGen = await generatePresentation(runId, markdown);

    // 5. Distribute
    await prisma.run.update({ where: { id: runId }, data: { progress: 80 } });
    const driveFile = await uploadFileToDrive(runId, gammaGen.pdfUrl, `Veille IA - Semaine ${new Date().toISOString()}`, 'application/pdf');
    await sendEmail(runId, [process.env.GMAIL_SENDER], 'Veille IA - Nouvelle présentation', `<p>La présentation de la semaine est disponible.</p>`, gammaGen.pdfUrl, gammaGen.gammaUrl);

    // Done
    await prisma.run.update({ where: { id: runId }, data: { status: 'DONE', progress: 100, finishedAt: new Date(), links: {
      gammaUrl: gammaGen.gammaUrl,
      pdfUrl: gammaGen.pdfUrl,
      driveLink: driveFile.webViewLink,
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
