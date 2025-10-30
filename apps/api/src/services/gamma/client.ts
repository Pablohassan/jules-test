import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GAMMA_API_KEY = process.env.GAMMA_API_KEY;
const GAMMA_API_URL = 'https://api.gamma.app';

interface GammaCreateResponse {
  id: string;
  status: string;
}

interface GammaPollResponse {
  id: string;
  status: string;
  gammaUrl?: string;
  pdfUrl?: string;
  pptxUrl?: string;
}

async function createPresentation(markdown: string, options: { exportAs: 'pdf' | 'pptx' }): Promise<GammaCreateResponse> {
  const response = await fetch(`${GAMMA_API_URL}/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GAMMA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: markdown,
      textMode: 'preserve',
      format: 'presentation',
      exportAs: options.exportAs,
    }),
  });

  if (!response.ok) {
    throw new Error(`Gamma API request failed with status ${response.status}`);
  }

  return response.json();
}

async function pollGeneration(id: string): Promise<GammaPollResponse> {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${GAMMA_API_URL}/generate/${id}`, {
          headers: { 'Authorization': `Bearer ${GAMMA_API_KEY}` },
        });

        if (!response.ok) {
          clearInterval(interval);
          return reject(new Error(`Gamma polling failed with status ${response.status}`));
        }

        const data: GammaPollResponse = await response.json();

        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
          resolve(data);
        }
      } catch (error) {
        clearInterval(interval);
        reject(error);
      }
    }, 3000); // Poll every 3 seconds

    setTimeout(() => {
      clearInterval(interval);
      reject(new Error('Gamma generation timed out after 90 seconds.'));
    }, 90000); // Timeout after 90 seconds
  });
}

export async function generatePresentation(runId: string, markdown: string) {
  const createResponse = await createPresentation(markdown, { exportAs: 'pdf' });

  const pollResponse = await pollGeneration(createResponse.id);

  if (pollResponse.status === 'completed') {
    const gammaGen = await prisma.gammaGen.create({
      data: {
        runId,
        generationId: pollResponse.id,
        status: pollResponse.status,
        gammaUrl: pollResponse.gammaUrl,
        pdfUrl: pollResponse.pdfUrl,
        pptxUrl: pollResponse.pptxUrl,
      },
    });
    return gammaGen;
  } else {
    throw new Error(`Gamma generation failed with status: ${pollResponse.status}`);
  }
}
