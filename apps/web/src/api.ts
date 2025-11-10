import { z } from 'zod';

const API_BASE_URL = '/api';

const emailLogSchema = z.object({
  id: z.string(),
  to: z.array(z.string()),
  subject: z.string(),
  messageId: z.string().nullable().optional(),
  status: z.string(),
  error: z.string().nullable().optional(),
});

const driveFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  webViewLink: z.string(),
});

const runSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  keywords: z.array(z.string()),
  status: z.string(),
  progress: z.number(),
  links: z.any().optional(),
  meta: z.any().optional(),
  emailLogs: z.array(emailLogSchema).optional(),
  driveFiles: z.array(driveFileSchema).optional(),
});

export const runsSchema = z.array(runSchema);

const gammaOptionsSchema = z.object({
  exportAs: z.enum(['pdf','pptx']).optional(),
  textMode: z.enum(['generate','condense','preserve']).optional(),
  format: z.enum(['presentation','document','webpage','social']).optional(),
  themeId: z.string().optional(),
  numCards: z.number().optional(),
  additionalInstructions: z.string().optional(),
  folderIds: z.array(z.string()).optional(),
  cardSplit: z.enum(['auto','inputTextBreaks']).optional(),
  textOptions: z.object({ language: z.string().optional() }).optional(),
  imageOptions: z.object({ model: z.string().optional() }).optional(),
}).optional();

const createRunPayloadSchema = z.object({
  keywords: z.array(z.string()),
  daysBack: z.number(),
  maxResults: z.number(),
  gammaOptions: gammaOptionsSchema,
});

export type CreateRunPayload = z.infer<typeof createRunPayloadSchema>;

// Features schema
export const featuresSchema = z.object({
  searchAvailable: z.boolean(),
  summarizeAvailable: z.boolean(),
  gammaAvailable: z.boolean(),
  googleOAuthConfigured: z.boolean(),
  googleConnected: z.boolean().optional().default(false),
  gmailConfigured: z.boolean(),
  driveConfigured: z.boolean(),
  webOrigin: z.string().nullable(),
});
export type Features = z.infer<typeof featuresSchema>;

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

export async function retryDistribution(id: string) {
  const response = await fetch(`${API_BASE_URL}/runs/${id}/distribute`, { method: 'POST' });
  if (!response.ok) {
    throw new Error('Failed to queue distribution');
  }
  return response.json();
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

export async function getFeatures() {
  const response = await fetch(`${API_BASE_URL}/features?ts=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to fetch features');
  }
  const data = await response.json();
  return featuresSchema.parse(data);
}

export async function disconnectGoogle() {
  const res = await fetch(`${API_BASE_URL}/auth/google/disconnect`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to disconnect Google');
  return res.json();
}
