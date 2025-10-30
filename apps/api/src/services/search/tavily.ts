import { PrismaClient } from '@prisma/client';

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

async function searchTavily(query: string, maxResults: number): Promise<TavilyResult[]> {
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
      max_results: maxResults,
      include_domains: [],
      exclude_domains: [],
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily API request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.results || [];
}

export async function searchArticles(runId: string, keywords: string[], daysBack: number, maxResults: number) {
  const query = keywords.join(' OR ');

  // Tavily's API doesn't have a specific `daysBack` filter,
  // so we'd rely on the freshness of their index or filter by date later if available.
  const results = await searchTavily(query, maxResults);

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
