import { Router } from 'express';
import prismaPkg from '@prisma/client';
const { PrismaClient } = prismaPkg as typeof import('@prisma/client');
const prisma = new PrismaClient();

const router: Router = Router();

router.get('/', async (_req, res) => {
  const token = await prisma.oAuthToken.findFirst({ where: { provider: 'google' } });
  const features = {
    searchAvailable: Boolean(process.env.TAVILY_API_KEY),
    summarizeAvailable: Boolean(process.env.OPENAI_API_KEY),
    gammaAvailable: Boolean(process.env.GAMMA_API_KEY),
    googleOAuthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI),
    googleConnected: Boolean(token),
    gmailConfigured: Boolean(process.env.GMAIL_SENDER),
    driveConfigured: Boolean(process.env.DRIVE_FOLDER_ID),
    webOrigin: process.env.WEB_ORIGIN || null,
  } as const;

  res.json(features);
});

export default router;
