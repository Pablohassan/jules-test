import { PrismaClient, Source } from '@prisma/client';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

const prisma = new PrismaClient();
const turndownService = new TurndownService();

const JINA_READER_URL = 'https://r.jina.ai/';

async function fetchWithTimeout(url: string, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(id);

  return response;
}

async function readWithJina(url: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(`${JINA_READER_URL}${url}`);
    if (response.ok) {
      const text = await response.text();
      // Basic check for valid content, as Jina might return empty/error pages
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
    const html = await response.text();
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
    });
    return article;
  } else {
    console.warn(`Failed to extract content for ${source.url}`);
    // Log this failure, but don't stop the run
    return null;
  }
}
