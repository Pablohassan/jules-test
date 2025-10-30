import { z } from 'zod';

const API_BASE_URL = '/api';

const runSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  keywords: z.array(z.string()),
  status: z.string(),
  progress: z.number(),
  links: z.any().optional(),
});

export const runsSchema = z.array(runSchema);

const createRunPayloadSchema = z.object({
  keywords: z.array(z.string()),
  daysBack: z.number(),
  maxResults: z.number(),
});

export type CreateRunPayload = z.infer<typeof createRunPayloadSchema>;

export async function getRuns() {
  const response = await fetch(`${API_BASE_URL}/runs`);
  if (!response.ok) {
    throw new Error('Failed to fetch runs');
  }
  const data = await response.json();
  return runsSchema.parse(data);
}

export async function getRun(id: string) {
  const response = await fetch(`${API_BASE_URL}/runs/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch run');
  }
  const data = await response.json();
  return runSchema.parse(data);
}

export async function createRun(payload: CreateRunPayload) {
  const response = await fetch(`${API_BASE_URL}/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to create run');
  }

  return response.json();
}
