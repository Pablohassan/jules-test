import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedClient } from './client.js';
import { Readable } from 'stream';

const prisma = new PrismaClient();
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID;

async function fetchFileAsBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch file from ${url}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function uploadFileToDrive(runId: string, fileUrl: string, fileName: string, mimeType: string) {
  try {
    const auth = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });

    const fileBuffer = await fetchFileAsBuffer(fileUrl);
    const fileStream = new Readable();
    fileStream.push(fileBuffer);
    fileStream.push(null);

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: mimeType,
        parents: DRIVE_FOLDER_ID ? [DRIVE_FOLDER_ID] : undefined,
      },
      media: {
        mimeType: mimeType,
        body: fileStream,
      },
      fields: 'id, webViewLink',
    });

    const fileId = response.data.id;
    const webViewLink = response.data.webViewLink;

    if (!fileId || !webViewLink) {
      throw new Error('Failed to get fileId or webViewLink from Google Drive API');
    }

    const driveFile = await prisma.driveFile.create({
      data: {
        runId,
        fileId,
        name: fileName,
        webViewLink,
      },
    });

    return driveFile;
  } catch (error) {
    console.error(`Failed to upload file to Google Drive for run ${runId}:`, error);
    // Log error and allow the run to continue
    return null;
  }
}
