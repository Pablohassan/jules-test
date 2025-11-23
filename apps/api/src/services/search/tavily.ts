import prismaPkg from '@prisma/client';
const { PrismaClient } = prismaPkg as typeof import('@prisma/client');

const prisma = new PrismaClient();

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_API_URL = 'https://api.tavily.com/search';

interface TavilyResult {
  url: string;
  title: string;
  content: string;
  score: number;
  raw_content: string;
}

const IGNORE_PATTERNS = [
  /\/tag\//i,
  /\/category\//i,
  /\/topics?\//i,
  /\/(search|login|subscribe|privacy|terms|about)\b/i,
  /\/(feed|rss)\b/i,
  /\bauthor\//i,
];

const IGNORE_DOMAINS = new Set([
  'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'youtube.com',
]);

async function searchTavily(query: string, maxResults: number, daysBack: number): Promise<TavilyResult[]> {
  const response = await fetch(TAVILY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: 'advanced',
      include_answer: false,
      include_raw_content: false,
      max_results: maxResults * 2, // Request more to compensate for date filtering
      include_domains: [],
      exclude_domains: [],
      days: daysBack, // Tavily parameter to limit search to recent results
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily API request failed with status ${response.status}`);
  }

  const data = await response.json();
  const results: TavilyResult[] = data.results || [];
  // Filter out obvious non-article pages
  return results.filter((r: TavilyResult) => {
    try {
      const u = new URL(r.url);
      if (IGNORE_DOMAINS.has(u.hostname)) return false;
      if (IGNORE_PATTERNS.some((re) => re.test(u.pathname))) return false;
      return true;
    } catch {
      return false;
    }
  });
}

export async function searchArticles(runId: string, keywords: string[], daysBack: number, maxResults: number) {
  const query = keywords.join(' OR ');

  // Tavily now includes days parameter + we filter by publication date
  const results = await searchTavily(query, maxResults, daysBack);

  // Calculate cutoff date (today - daysBack)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  console.log(`[Search] Filtering articles published after ${cutoffDate.toISOString()} (last ${daysBack} days)`);

  const uniqueUrls = new Set<string>();
  const sourcesToCreate = [];

  for (const result of results) {
    if (!uniqueUrls.has(result.url)) {
      uniqueUrls.add(result.url);
      sourcesToCreate.push({
        url: result.url,
        title: result.title,
        siteName: new URL(result.url).hostname,
      });
    }
  }

  // Use a transaction to create sources and connect them to the run
  const createdSources = await prisma.$transaction(
    sourcesToCreate.map(sourceData =>
      prisma.source.upsert({
        where: { url: sourceData.url },
        update: {}, // Do nothing if it already exists
        create: sourceData,
      })
    )
  );

  // After creating/finding sources, you would typically link them to the Run,
  // but the Prisma schema doesn't have a direct Run<>Source relation.
  // Instead, the link is established when an Article is created.

  return createdSources;
}
