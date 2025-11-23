import prismaPkg from '@prisma/client';
import type { Source } from '@prisma/client';
const { PrismaClient } = prismaPkg as typeof import('@prisma/client');
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

const prisma = new PrismaClient();
const turndownService = new TurndownService();

// Reader provider configuration
const JINA_PUBLIC_URL = 'https://r.jina.ai/';
const JINA_API_URL = process.env.JINA_API_URL || JINA_PUBLIC_URL; // You can point to a private/paid endpoint
const JINA_API_KEY = process.env.JINA_API_KEY; // Optional: some deployments may require/accept a bearer token

async function fetchWithTimeout(url: string, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(id);

  return response;
}

async function readWithJina(url: string): Promise<string | null> {
  try {
    // If user points to a JSON-style endpoint (e.g., /read), try POST JSON first
    if (/\/read\/?$/.test(JINA_API_URL)) {
      const response = await fetchWithTimeout(JINA_API_URL, 20000);
      // If hitting a POST-only endpoint, retry with POST body
      if (!response.ok || response.status === 405 || response.status === 404) {
        const r2 = await fetch(JINA_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(JINA_API_KEY ? { Authorization: `Bearer ${JINA_API_KEY}` } : {}),
            Accept: 'application/json',
          },
          body: JSON.stringify({ url }),
        });
        if (r2.ok) {
          const ct = r2.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const data: any = await r2.json();
            const text = typeof data?.content === 'string' ? data.content : JSON.stringify(data);
            return text && text.length > 500 ? text : null;
          }
          const txt = await r2.text();
          return txt.length > 500 ? txt : null;
        }
      }
    }

    // Default: prepend to URL path (public Reader style)
    const target = `${JINA_API_URL.endsWith('/') ? JINA_API_URL : JINA_API_URL + '/'}${url}`;
    const response = await fetchWithTimeout(target, 20000);
    if (response.ok) {
      const ct = response.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data: any = await response.json();
        const text = typeof data?.content === 'string' ? data.content : JSON.stringify(data);
        return text && text.length > 500 ? text : null;
      }
      const text = await response.text();
      return text.length > 500 ? text : null;
    }
  } catch (error) {
    console.error(`Jina Reader API failed for ${url}:`, error);
  }
  return null;
}

async function readWithReadability(url: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(url);
    let html = await response.text();
    // Strip <style> blocks to avoid jsdom CSS parser crashes on exotic CSS
    try {
      html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    } catch {}
    const doc = new JSDOM(html, { url });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    if (article && article.textContent.length > 500) {
      return turndownService.turndown(article.content);
    }
  } catch (error) {
    console.error(`Readability fallback failed for ${url}:`, error);
  }
  return null;
}

export async function fetchAndRead(runId: string, source: Source) {
  let markdownContent = await readWithJina(source.url);

  if (!markdownContent) {
    markdownContent = await readWithReadability(source.url);
  }

  if (markdownContent) {
    // Content is clean and long enough, create the Article
    const article = await prisma.article.create({
      data: {
        runId,
        sourceId: source.id,
        textMd: markdownContent,
        // lang detection would be implemented here
      },
      include: {
        source: true,
      }
    });
    return article;
  } else {
    console.warn(`Failed to extract content for ${source.url}`);
    // Log this failure, but don't stop the run
    return null;
  }
}
