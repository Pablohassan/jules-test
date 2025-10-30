import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedClient } from './client.js';
import nodemailer from 'nodemailer';
import { Readable } from 'stream';

const prisma = new PrismaClient();

async function fetchFileAsBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch file from ${url}: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

export async function sendEmail(runId: string, to: string[], subject: string, html: string, pdfUrl: string, gammaUrl: string) {
    try {
        const auth = await getAuthenticatedClient();
        const gmail = google.gmail({ version: 'v1', auth });

        const tokenInfo = await auth.getTokenInfo(auth.credentials.access_token!);
        const emailAddress = tokenInfo.email;

        if (!emailAddress) {
            throw new Error('Could not determine user email address from token.');
        }

        const transport = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: emailAddress,
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                refreshToken: auth.credentials.refresh_token!,
                accessToken: auth.credentials.access_token!,
            },
        });

        const pdfBuffer = await fetchFileAsBuffer(pdfUrl);

        const mailOptions = {
            from: process.env.GMAIL_SENDER,
            to: to.join(','),
            subject: subject,
            html: `${html}<p>View the presentation online: <a href="${gammaUrl}">${gammaUrl}</a></p>`,
            attachments: [
                {
                    filename: 'presentation.pdf',
                    content: pdfBuffer,
                    contentType: 'application/pdf',
                },
            ],
        };

        const result = await transport.sendMail(mailOptions);

        await prisma.emailLog.create({
            data: {
                runId,
                to,
                subject,
                messageId: result.messageId,
                status: 'SENT',
            },
        });

        return result;
    } catch (error) {
        console.error(`Failed to send email for run ${runId}:`, error);
        await prisma.emailLog.create({
            data: {
                runId,
                to,
                subject,
                status: 'FAILED',
                error: (error as Error).message,
            },
        });
        return null;
    }
}
