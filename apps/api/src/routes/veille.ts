import { Router } from 'express';
import prismaPkg from '@prisma/client';
const { PrismaClient } = prismaPkg as typeof import('@prisma/client');

const router: Router = Router();
const prisma = new PrismaClient();

// Get all veilles (optional filter by clientId)
router.get('/', async (req, res) => {
  try {
    const { clientId } = req.query;
    const where = clientId ? { clientId: String(clientId) } : {};
    const veilles = await prisma.veille.findMany({
      where,
      include: { client: true, runs: { take: 5, orderBy: { createdAt: 'desc' } } }
    });
    res.json(veilles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch veilles' });
  }
});

// Get single veille
router.get('/:id', async (req, res) => {
  try {
    const veille = await prisma.veille.findUnique({
      where: { id: req.params.id },
      include: { client: true, runs: { take: 10, orderBy: { createdAt: 'desc' } } }
    });
    if (!veille) return res.status(404).json({ error: 'Veille not found' });
    res.json(veille);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch veille' });
  }
});

// Create veille
router.post('/', async (req, res) => {
  try {
    const { clientId, name, keywords, schedule, enabled } = req.body;
    const veille = await prisma.veille.create({
      data: { clientId, name, keywords, schedule, enabled }
    });
    res.json(veille);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create veille' });
  }
});

// Update veille
router.put('/:id', async (req, res) => {
  try {
    const { name, keywords, schedule, enabled } = req.body;
    const veille = await prisma.veille.update({
      where: { id: req.params.id },
      data: { name, keywords, schedule, enabled }
    });
    res.json(veille);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update veille' });
  }
});

// Delete veille
router.delete('/:id', async (req, res) => {
  try {
    await prisma.veille.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete veille' });
  }
});

export default router;
