import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { orchestrationQueue } from '@/queue.js';
import { z } from 'zod';

const prisma = new PrismaClient();
const router: Router = Router();

const createRunSchema = z.object({
  keywords: z.array(z.string()).min(1),
  daysBack: z.number().min(1).max(30),
  maxResults: z.number().min(1).max(50).optional().default(10),
});

// POST /api/runs
router.post('/', async (req, res, next) => {
  try {
    const { keywords, daysBack, maxResults } = createRunSchema.parse(req.body);

    const run = await prisma.run.create({
      data: {
        keywords,
        daysBack,
        maxResults,
      },
    });

    await orchestrationQueue.add('run', {
      runId: run.id,
      keywords,
      daysBack,
      maxResults,
    });

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

export default router;
