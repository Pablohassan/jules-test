import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';
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

  // Store the tokens in the database
  await prisma.oAuthToken.create({
    data: {
      provider: 'google',
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token,
      expiryDate: new Date(tokens.expiry_date!),
      scopes: tokens.scope ? tokens.scope.split(' ') : [],
    },
  });

  return tokens;
}
