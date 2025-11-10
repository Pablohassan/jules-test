import prismaPkg from '@prisma/client';
const { PrismaClient } = prismaPkg as typeof import('@prisma/client');

const prisma = new PrismaClient();

// Gamma API configuration (supports both legacy and v1.0 styles)
const GAMMA_API_KEY = process.env.GAMMA_API_KEY || '';
// Prefer the documented public host by default; env can override
const GAMMA_API_BASE = (process.env.GAMMA_API_BASE || 'https://public-api.gamma.app').replace(/\/$/, '');
// Prefer v1.0 per docs; we will also try v1 as a fallback
const GAMMA_API_VERSION = (process.env.GAMMA_API_VERSION || 'v1.0').replace(/^\//, '').replace(/\/$/, '');
// Default to x-api-key per Gamma docs; we'll still try both styles below
const GAMMA_API_AUTH_STYLE = (process.env.GAMMA_API_AUTH_STYLE || 'x-api-key').toLowerCase(); // 'x-api-key' | 'bearer'
const RAW_GENERATE_PATH = process.env.GAMMA_API_GENERATE_PATH || '/generations';
const GAMMA_API_GENERATE_PATH = RAW_GENERATE_PATH.startsWith('/') ? RAW_GENERATE_PATH : `/${RAW_GENERATE_PATH}`;
// Only include exports if explicitly configured; default to none to avoid 400s on strict tenants
const GAMMA_EXPORTS = (process.env.GAMMA_EXPORTS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Shared candidates for all requests
const HOST_CANDIDATES = Array.from(new Set([
  'https://public-api.gamma.app',
  GAMMA_API_BASE,
  'https://api.gamma.app',
]));

const VERSION_CANDIDATES = Array.from(new Set([
  GAMMA_API_VERSION,
  'v1.0',
  'v1',
].filter(Boolean)));

function gammaUrl(path: string) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${GAMMA_API_BASE}/${GAMMA_API_VERSION}${p}`;
}

function gammaHeaders(extra?: Record<string, string>, authStyle?: 'bearer' | 'x-api-key') {
  const h: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  const style = (authStyle || GAMMA_API_AUTH_STYLE);
  if (style === 'bearer') {
    if (GAMMA_API_KEY) h['Authorization'] = `Bearer ${GAMMA_API_KEY}`;
  } else {
    if (GAMMA_API_KEY) h['X-API-KEY'] = `${GAMMA_API_KEY}`;
  }
  if (extra) Object.assign(h, extra);
  return h;
}

type ExportFormat = 'pdf' | 'pptx';

function inferExportFormat(hint?: string, url?: string): ExportFormat | undefined {
  const normalizedHint = hint?.toLowerCase() || '';
  if (normalizedHint.includes('pdf')) return 'pdf';
  if (normalizedHint.includes('ppt')) return 'pptx';
  const value = (url || '').toLowerCase();
  if (value.endsWith('.pdf') || value.includes('/pdf/')) return 'pdf';
  if (value.endsWith('.pptx') || value.includes('/ppt')) return 'pptx';
  return undefined;
}

async function resolveExportEntry(entry: any): Promise<{ url?: string; hint?: string }> {
  if (!entry) return {};
  if (typeof entry === 'string') return { url: entry };
  const hint = entry.type || entry.format || entry.kind || entry.fileType || entry.extension || entry.mimeType;
  const direct = entry.url || entry.downloadUrl || entry.fileUrl || entry.signedUrl || entry.href;
  if (typeof direct === 'string') return { url: direct, hint };

  const fileToUrlEndpoint = entry.fileToUrl || entry.fileToURL;
  const fileToken = entry.fileToken || entry.file_token;
  const fileId = entry.fileId || entry.file_id;
  if (fileToUrlEndpoint && (fileToken || fileId)) {
    const payload: Record<string, string> = {};
    if (fileToken) payload.fileToken = fileToken;
    if (fileId) payload.fileId = fileId;
    try {
      const res = await fetch(fileToUrlEndpoint, {
        method: 'POST',
        headers: gammaHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data: any = await res.json().catch(() => null);
        const resolved = data?.url || data?.downloadUrl || data?.fileUrl || data?.signedUrl;
        if (resolved) {
          return { url: resolved, hint: hint || data?.type || data?.format };
        }
      }
    } catch {}
  }
  return {};
}

async function extractExportUrls(payload: any): Promise<{ pdfUrl?: string; pptxUrl?: string }> {
  const results: { pdfUrl?: string; pptxUrl?: string } = {};
  const addCandidate = (url?: string, hint?: string) => {
    if (!url || typeof url !== 'string') return;
    const format = inferExportFormat(hint, url);
    if (format === 'pdf' && !results.pdfUrl) results.pdfUrl = url;
    if (format === 'pptx' && !results.pptxUrl) results.pptxUrl = url;
  };

  addCandidate(payload?.pdfUrl, 'pdf');
  addCandidate(payload?.pptxUrl, 'pptx');
  addCandidate(payload?.exportUrl);
  addCandidate(payload?.urls?.pdf, 'pdf');
  addCandidate(payload?.urls?.pptx, 'pptx');
  addCandidate(payload?.links?.pdf, 'pdf');
  addCandidate(payload?.links?.pptx, 'pptx');

  const collections = [
    payload?.exports,
    payload?.exportUrls,
    payload?.assets,
    payload?.files,
    payload?.urls?.exports,
    payload?.links?.exports,
  ];

  const addFromCollection = async (collection: any) => {
    if (!collection) return;
    if (Array.isArray(collection)) {
      for (const entry of collection) {
        const resolved = await resolveExportEntry(entry);
        addCandidate(resolved.url, resolved.hint);
      }
    } else if (typeof collection === 'object') {
      for (const value of Object.values(collection)) {
        const resolved = await resolveExportEntry(value);
        addCandidate(resolved.url, resolved.hint);
      }
    }
  };

  for (const collection of collections) {
    await addFromCollection(collection);
    if (results.pdfUrl && results.pptxUrl) break;
  }

  return results;
}

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

type GammaCreateOptions = {
  exportAs?: 'pdf' | 'pptx'
  textMode?: 'generate' | 'condense' | 'preserve'
  format?: 'presentation' | 'document' | 'webpage' | 'social'
  themeId?: string
  numCards?: number
  additionalInstructions?: string
  folderIds?: string[]
  cardSplit?: 'auto' | 'inputTextBreaks'
  textOptions?: { language?: string }
  imageOptions?: { model?: string }
  cardOptions?: Record<string, unknown>
};

async function createPresentation(markdown: string, options: GammaCreateOptions = {}): Promise<GammaCreateResponse> {
  // Try multiple endpoint permutations for compatibility across API deployments.
  const tryPaths = Array.from(new Set([
    // Versioned candidates for configured and common versions across known hosts
    ...HOST_CANDIDATES.flatMap(h => VERSION_CANDIDATES.map(v => `${h}/${v}${GAMMA_API_GENERATE_PATH}`)),
    ...HOST_CANDIDATES.flatMap(h => VERSION_CANDIDATES.map(v => `${h}/${v}/generations`)),
    // Without version across hosts
    ...HOST_CANDIDATES.map(h => `${h}${GAMMA_API_GENERATE_PATH}`),
    ...HOST_CANDIDATES.map(h => `${h}/generations`),
  ]));

  const authStyles: Array<'bearer' | 'x-api-key'> = GAMMA_API_AUTH_STYLE === 'bearer'
    ? ['bearer', 'x-api-key']
    : ['x-api-key', 'bearer'];

  // Build a minimal payload first; some tenants reject unknown/extra fields.
  const minimalPayload: any = {
    inputText: markdown,
    textMode: options.textMode || 'preserve',
    format: options.format || 'presentation',
  };
  if (options.exportAs) minimalPayload.exportAs = options.exportAs;

  const extendedPayload: any = {
    ...minimalPayload,
    // Only include exports if explicitly configured
    ...(GAMMA_EXPORTS.length ? { exports: GAMMA_EXPORTS } : {}),
    ...(options.themeId ? { themeId: options.themeId } : {}),
    ...(options.numCards ? { numCards: options.numCards } : {}),
    ...(options.additionalInstructions ? { additionalInstructions: options.additionalInstructions } : {}),
    ...(options.folderIds ? { folderIds: options.folderIds } : {}),
    ...(options.cardSplit ? { cardSplit: options.cardSplit } : {}),
    ...(options.textOptions ? { textOptions: options.textOptions } : {}),
    ...(options.imageOptions ? { imageOptions: options.imageOptions } : {}),
    ...(options.cardOptions ? { cardOptions: options.cardOptions } : {}),
  };

  const errors: Array<{ url: string; status: number; text?: string }> = [];
  for (const style of authStyles) {
    for (const url of tryPaths) {
      try {
        // Try minimal payload first
        let response = await fetch(url, { method: 'POST', headers: gammaHeaders(undefined, style), body: JSON.stringify(minimalPayload) });
        if (!response.ok && response.status === 400) {
          // Retry with extended payload if minimal fails validation
          response = await fetch(url, { method: 'POST', headers: gammaHeaders(undefined, style), body: JSON.stringify(extendedPayload) });
        }
        if (response.ok) {
          const data = await response.json();
          const generationId = (data as any).generationId || (data as any).id;
          if (!generationId) throw new Error('Missing generationId in response');
          return { id: generationId, status: 'queued' } as GammaCreateResponse;
        } else {
          const text = await response.text().catch(() => '');
          errors.push({ url, status: response.status, text });
          // On 404/401/403, continue trying other variants
          continue;
        }
      } catch (e) {
        errors.push({ url, status: -1, text: (e as Error).message });
      }
    }
  }
  const msg = `Gamma API request failed. Attempts: ${errors.map(e => `${e.status} @ ${e.url}`).join(' | ')}`;
  throw new Error(msg);
}

async function pollGeneration(id: string): Promise<GammaPollResponse> {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        // Try versioned first, then non-versioned
        const urls = [
          ...HOST_CANDIDATES.flatMap(h => VERSION_CANDIDATES.map(v => `${h}/${v}/generations/${id}`)),
          ...HOST_CANDIDATES.map(h => `${h}/generations/${id}`),
        ];
        let response: any | null = null;
        let lastErr: any;
        for (const u of urls) {
          try {
            const r = await fetch(u, { headers: gammaHeaders() });
            if (r.ok) { response = r; break; }
            lastErr = new Error(`status ${r.status}`);
          } catch (e) { lastErr = e; }
        }
        if (!response) {
          clearInterval(interval);
          return reject(new Error(`Gamma polling failed: ${lastErr?.message || 'no response'}`));
        }

        const data: GammaPollResponse & { urls?: any; links?: any; assets?: any; generationId?: string } = await response.json();

        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
          const exportUrls = await extractExportUrls(data);
          // Normalize possible field names
          const normalized: GammaPollResponse = {
            id: (data as any).id || data.generationId || id,
            status: data.status,
            gammaUrl: (data as any).gammaUrl || data.urls?.share || data.links?.share || undefined,
            pdfUrl: exportUrls.pdfUrl,
            pptxUrl: exportUrls.pptxUrl,
          };
          resolve(normalized);
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

export async function generatePresentation(runId: string, markdown: string, opts?: GammaCreateOptions) {
  const createResponse = await createPresentation(markdown, { exportAs: 'pdf', ...(opts || {}) });

  const pollResponse = await pollGeneration(createResponse.id);

  if (pollResponse.status === 'completed') {
    // If assets are not directly in poll response, keep fields possibly undefined; ensure on-demand via ensureGammaExports
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

// Best-effort: ensure export URLs (pdf/pptx) exist for a generation id
export async function ensureGammaExports(generationId: string) {
  const maxWaitMs = Number(process.env.GAMMA_EXPORT_MAX_WAIT_MS || 120000);
  const pollMs = Number(process.env.GAMMA_EXPORT_POLL_MS || 3000);
  const attempts = Math.max(1, Math.ceil(maxWaitMs / pollMs));

  // Kick export flows on implementations that support it
  try {
    await fetch(gammaUrl(`/generations/${generationId}/exports/pdf`), { method: 'POST', headers: gammaHeaders() });
  } catch {}
  try {
    await fetch(gammaUrl(`/generations/${generationId}/exports`), { method: 'POST', headers: gammaHeaders(), body: JSON.stringify({ exportAs: 'pdf' }) });
  } catch {}

  for (let i = 0; i < attempts; i++) {
    try {
      // Prefer assets endpoint if available
      let pdfUrl: string | undefined;
      let pptxUrl: string | undefined;
      try {
        const tryAssets = [
          ...HOST_CANDIDATES.flatMap(h => VERSION_CANDIDATES.map(v => `${h}/${v}/generations/${generationId}/assets`)),
          ...HOST_CANDIDATES.map(h => `${h}/generations/${generationId}/assets`),
        ];
        let assetsRes: any | null = null;
        for (const u of tryAssets) {
          const r = await fetch(u, { headers: gammaHeaders() });
          if (r.ok) { assetsRes = r; break; }
        }
        if (!assetsRes) throw new Error('assets endpoint not available');
        const assets: any = await assetsRes.json().catch(() => []);
        const list: any[] = Array.isArray(assets) ? assets : (assets?.assets && Array.isArray(assets.assets) ? assets.assets : []);
        const extracted = await extractExportUrls({ assets: list });
        pdfUrl = extracted.pdfUrl;
        pptxUrl = extracted.pptxUrl;
      } catch {}

      if (!pdfUrl || !pptxUrl) {
        let r: any | null = null;
        const tryGen = [
          ...HOST_CANDIDATES.flatMap(h => VERSION_CANDIDATES.map(v => `${h}/${v}/generations/${generationId}`)),
          ...HOST_CANDIDATES.map(h => `${h}/generations/${generationId}`),
        ];
        for (const u of tryGen) {
          const t = await fetch(u, { headers: gammaHeaders() });
          if (t.ok) { r = t; break; }
        }
        if (r) {
          const data: any = await r.json();
          const extracted = await extractExportUrls(data);
          pdfUrl = pdfUrl || extracted.pdfUrl;
          pptxUrl = pptxUrl || extracted.pptxUrl;
        }
      }

      if (pdfUrl || pptxUrl) {
        await prisma.gammaGen.updateMany({
          where: { generationId },
          data: { pdfUrl: pdfUrl || undefined, pptxUrl: pptxUrl || undefined },
        });
        return { pdfUrl, pptxUrl };
      }
    } catch {}
    await new Promise((res) => setTimeout(res, pollMs));
  }
  return null;
}

export async function downloadAssetToBuffer(url: string): Promise<Buffer> {
  // If the asset URL is on Gamma API host, include auth headers.
  const needsAuth = url.startsWith(`${GAMMA_API_BASE}/`) || url.includes(new URL(GAMMA_API_BASE).hostname);
  const res = await fetch(url, { headers: needsAuth ? gammaHeaders() : undefined } as any);
  if (!res.ok) throw new Error(`Failed to download asset: ${res.status}`);
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}
