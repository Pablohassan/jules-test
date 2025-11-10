import { google } from 'googleapis';
import prismaPkg from '@prisma/client';
const { PrismaClient } = prismaPkg as typeof import('@prisma/client');
import { OAuth2Client } from 'google-auth-library';

const prisma = new PrismaClient();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export function getGoogleAuthURL() {
  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/gmail.send',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
  });
}

import { GetTokenResponse } from 'google-auth-library';

export async function handleGoogleCallback(code: string): Promise<GetTokenResponse> {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Merge with existing token: keep prior refresh token if Google did not return a new one
  const existing = await prisma.oAuthToken.findFirst({ where: { provider: 'google' }, orderBy: { expiryDate: 'desc' } });
  const refreshToken = tokens.refresh_token || existing?.refreshToken || null;

  if (existing) {
    await prisma.oAuthToken.update({
      where: { id: existing.id },
      data: {
        accessToken: tokens.access_token!,
        refreshToken: refreshToken!,
        expiryDate: new Date(tokens.expiry_date!),
        scopes: tokens.scope ? tokens.scope.split(' ') : existing.scopes,
      },
    });
  } else {
    await prisma.oAuthToken.create({
      data: {
        provider: 'google',
        accessToken: tokens.access_token!,
        refreshToken: refreshToken!,
        expiryDate: new Date(tokens.expiry_date!),
        scopes: tokens.scope ? tokens.scope.split(' ') : [],
      },
    });
  }

  return tokens;
}

export async function disconnectGoogle(): Promise<void> {
  // Try to revoke credentials with Google and then remove local token(s).
  const token = await prisma.oAuthToken.findFirst({ where: { provider: 'google' }, orderBy: { expiryDate: 'desc' } });
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  try {
    if (token) {
      oauth2Client.setCredentials({
        access_token: token.accessToken,
        refresh_token: token.refreshToken || undefined,
      });
      if (token.refreshToken) {
        // Prefer revoking the refresh token to fully disconnect
        await oauth2Client.revokeToken(token.refreshToken);
      } else if (token.accessToken) {
        await oauth2Client.revokeToken(token.accessToken);
      }
    }
  } catch {
    // Best-effort: ignore revoke errors
  }
  // Remove all stored tokens for Google provider
  await prisma.oAuthToken.deleteMany({ where: { provider: 'google' } });
}
