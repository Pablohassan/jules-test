import { Router } from 'express';
import prismaPkg from '@prisma/client';
const { PrismaClient } = prismaPkg as typeof import('@prisma/client');
import { orchestrationQueue, enqueueDistributionNow } from '@/queue.js';
import { z } from 'zod';

const prisma = new PrismaClient();
const router: Router = Router();

const gammaOptionsSchema = z.object({
  exportAs: z.enum(['pdf','pptx']).optional(),
  textMode: z.enum(['generate','condense','preserve']).optional(),
  format: z.enum(['presentation','document','webpage','social']).optional(),
  themeId: z.string().optional(),
  numCards: z.number().int().min(1).max(75).optional(),
  additionalInstructions: z.string().max(2000).optional(),
  folderIds: z.array(z.string()).optional(),
  cardSplit: z.enum(['auto','inputTextBreaks']).optional(),
  textOptions: z.object({ language: z.string().optional() }).optional(),
  imageOptions: z.object({ model: z.string().optional() }).optional(),
}).optional();

const createRunSchema = z.object({
  keywords: z.array(z.string()).min(1),
  daysBack: z.number().min(1).max(30),
  maxResults: z.number().min(1).max(50).optional().default(10),
  gammaOptions: gammaOptionsSchema,
});

// POST /api/runs
router.post('/', async (req, res, next) => {
  try {
    const { keywords, daysBack, maxResults, gammaOptions } = createRunSchema.parse(req.body);
    // Compute effective options and models snapshot
    const defaultGamma = { format: 'presentation', textMode: 'preserve', exportAs: 'pdf' } as any;
    const effectiveGamma = { ...defaultGamma, ...(gammaOptions || {}) } as any;
    if (!effectiveGamma.cardSplit) effectiveGamma.cardSplit = 'auto';

    const configuredModel = process.env.OPENAI_MODEL || 'gpt-5-mini';
    const openaiModel = configuredModel.startsWith('gpt-5') ? configuredModel : 'gpt-5-mini';

    const run = await prisma.run.create({
      data: {
        keywords,
        daysBack,
        maxResults,
        meta: {
          gammaOptionsRequested: gammaOptions || null,
          gammaOptionsEffective: effectiveGamma,
          models: { openaiModel },
        } as any,
      },
    });

    await orchestrationQueue.add('run', {
      runId: run.id,
      keywords,
      daysBack,
      maxResults,
      gammaOptions,
    }, { jobId: run.id, removeOnComplete: true });

    res.status(201).json({ runId: run.id });
  } catch (error) {
    next(error);
  }
});

// GET /api/runs
router.get('/', async (req, res, next) => {
  try {
    const runs = await prisma.run.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(runs);
  } catch (error) {
    next(error);
  }
});

// GET /api/runs/:id
router.get('/:id', async (req, res, next) => {
  try {
    const run = await prisma.run.findUnique({
      where: { id: req.params.id },
      include: {
        articles: { include: { source: true, summaries: true } },
        gammaGens: true,
        driveFiles: true,
        emailLogs: true,
      },
    });
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }
    res.json(run);
  } catch (error) {
    next(error);
  }
});

// POST /api/runs/:id/distribute — force a background distribution attempt now
router.post('/:id/distribute', async (req, res, next) => {
  try {
    await enqueueDistributionNow(req.params.id);
    res.json({ queued: true });
  } catch (error) {
    next(error);
  }
});

// Convenience GET route so you can click the link in a browser
router.get('/:id/distribute', async (req, res, next) => {
  try {
    await enqueueDistributionNow(req.params.id);
    res.json({ queued: true, via: 'GET' });
  } catch (error) {
    next(error);
  }
});

export default router;

// Server-Sent Events: live updates of a run
router.get('/:id/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const runId = req.params.id;

  function stepName(status: string, progress: number) {
    if (status === 'FAILED') return 'failed';
    if (status === 'DONE') return 'done';
    if (progress < 10) return 'queued';
    if (progress < 20) return 'search';
    if (progress < 40) return 'ingest';
    if (progress < 60) return 'summarize';
    if (progress < 80) return 'generate';
    if (progress < 100) return 'distribute';
    return 'done';
  }

  const send = async () => {
    try {
      const run = await prisma.run.findUnique({ where: { id: runId } });
      if (!run) {
        res.write(`event: end\n`);
        res.write(`data: {"error":"not_found"}\n\n`);
        res.end();
        return;
      }
      const data = {
        id: run.id,
        status: run.status,
        progress: run.progress,
        error: run.error || null,
        counts: run.counts || null,
        links: run.links || null,
        meta: run.meta || null,
        step: stepName(run.status, run.progress),
        finishedAt: run.finishedAt,
      };
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (run.status === 'DONE' || run.status === 'FAILED') {
        clearInterval(interval);
        res.write(`event: end\n`);
        res.write(`data: {"status":"${run.status}"}\n\n`);
        res.end();
      }
    } catch (e) {
      res.write(`event: error\n`);
      res.write(`data: {"message":"${(e as Error).message}"}\n\n`);
    }
  };

  // Send immediately, then poll
  await send();
  const interval = setInterval(send, 1000);
  req.on('close', () => clearInterval(interval));
});
