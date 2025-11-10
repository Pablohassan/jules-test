import { google } from 'googleapis';
import prismaPkg from '@prisma/client';
const { PrismaClient } = prismaPkg as typeof import('@prisma/client');
import { OAuth2Client } from 'google-auth-library';

const prisma = new PrismaClient();

export async function getAuthenticatedClient(): Promise<OAuth2Client> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  // Prefer a token that has a refreshToken; fall back to any token
  let token = await prisma.oAuthToken.findFirst({
    where: { provider: 'google', NOT: { refreshToken: null } },
    orderBy: { expiryDate: 'desc' },
  });
  if (!token) {
    token = await prisma.oAuthToken.findFirst({ where: { provider: 'google' }, orderBy: { expiryDate: 'desc' } });
  }

  if (!token) {
    throw new Error('No Google OAuth token found. Please authenticate.');
  }

  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: token.expiryDate.getTime(),
    scope: token.scopes.join(' '),
  });

  // Handle token refresh
  oauth2Client.on('tokens', async (tokens) => {
    await prisma.oAuthToken.update({
      where: { id: token.id },
      data: {
        accessToken: tokens.access_token!,
        expiryDate: new Date(tokens.expiry_date!),
      },
    });
  });

  return oauth2Client;
}
