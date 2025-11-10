import puppeteer from 'puppeteer';
import fs from 'fs';

function parseCookieHeader(cookieHeader: string, urlForDomain: string) {
  const parts = cookieHeader.split(';').map((s) => s.trim()).filter(Boolean);
  const cookies: Array<Parameters<typeof puppeteer.launch>[0] extends any ? any : never> = [] as any;
  // Assemble key=value pairs back into cookies (handles values with '=')
  let acc: string[] = [];
  for (const part of parts) {
    if (!part.includes('=')) continue;
    acc.push(part);
  }
  // Each acc item is key=value; we add basic cookie objects
  const url = new URL(urlForDomain);
  return acc.map((kv) => {
    const eq = kv.indexOf('=');
    const name = kv.slice(0, eq);
    const value = kv.slice(eq + 1);
    return { name, value, domain: `.${url.hostname}`, path: '/', httpOnly: false, secure: true } as any;
  });
}

export async function renderUrlToPdf(url: string): Promise<Buffer> {
  if (!url) throw new Error('renderUrlToPdf: url is required');
  // Prefer explicit env path when provided and exists
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  let executablePath = envPath && fs.existsSync(envPath) ? envPath : undefined;

  // Try common Linux paths in the Puppeteer base image
  if (!executablePath) {
    const candidates = [
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
    ];
    executablePath = candidates.find((p) => fs.existsSync(p));
  }

  // Last resort: let Puppeteer decide (it may download if cache is enabled)
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: executablePath || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
    ],
  });
  try {
    const page = await browser.newPage();
    // Try to look less like automation
    const ua = process.env.HEADLESS_USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    await page.setUserAgent(ua);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7' });

    // Optional cookie injection to bypass protective interstitials when user is already authenticated in browser
    const cookieHeader = process.env.GAMMA_HEADLESS_COOKIES;
    if (cookieHeader) {
      try {
        const cookies = parseCookieHeader(cookieHeader, url);
        if (cookies.length) {
          // Navigate to base domain first to set cookies
          const u = new URL(url);
          await page.goto(`${u.protocol}//${u.hostname}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
          await page.setCookie(...(cookies as any));
        }
      } catch {}
    }
    await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
    // cache-buster to avoid stale interstitials
    const tsUrl = new URL(url);
    tsUrl.searchParams.set('ts', Date.now().toString());
    await page.goto(tsUrl.toString(), { waitUntil: 'networkidle2', timeout: 120_000 });
    await page.emulateMediaType('screen');
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });
    return buffer;
  } finally {
    await browser.close().catch(() => {});
  }
}
