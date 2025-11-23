import { Router } from 'express';
import prismaPkg from '@prisma/client';
const { PrismaClient } = prismaPkg as typeof import('@prisma/client');

const router: Router = Router();
const prisma = new PrismaClient();

// Get all clients
router.get('/', async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      include: { veilles: true }
    });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Get single client
router.get('/:id', async (req, res) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: { veilles: true }
    });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

// Create client
router.post('/', async (req, res) => {
  try {
    const { name, sector, size, description, email } = req.body;
    const client = await prisma.client.create({
      data: { name, sector, size, description, email }
    });
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// Update client
router.put('/:id', async (req, res) => {
  try {
    const { name, sector, size, description, email } = req.body;
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: { name, sector, size, description, email }
    });
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// Delete client
router.delete('/:id', async (req, res) => {
  try {
    await prisma.client.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

export default router;
