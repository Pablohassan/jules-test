import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
You are an expert summarizer for an AI-powered news watch.
Your task is to generate a structured JSON summary from the provided article text.
The JSON output must strictly adhere to the following format:
{
  "title": "string",
  "sourceName": "string",
  "date": "ISO 8601 date string or null",
  "bullets": ["string", "string", "string", "string", "string"],
  "quote": "string (max 20 words)",
  "links": ["url", "url"],
  "impact": "string (optional, 1-2 sentences targeting SMEs/industry)"
}

Constraints:
- 'bullets' must contain exactly 5 concise points in French.
- 'quote' must be a direct quote from the article, no longer than 20 words.
- 'links' must contain a maximum of 2 relevant URLs found in the article.
- All text should be in French.
`;

export async function summarizeArticle(articleId: string, textMd: string, meta: { title?: string, sourceName?: string, date?: Date }) {
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Summarize the following article:\n\nTitle: ${meta.title}\nSource: ${meta.sourceName}\nDate: ${meta.date}\n\n${textMd}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const summaryJson = JSON.parse(response.choices[0].message.content || '{}');

    // Basic validation
    if (
      !summaryJson.title ||
      !summaryJson.sourceName ||
      !Array.isArray(summaryJson.bullets) ||
      summaryJson.bullets.length !== 5
    ) {
      throw new Error('Invalid JSON format received from OpenAI');
    }

    const summary = await prisma.summary.create({
      data: {
        articleId,
        title: summaryJson.title,
        sourceName: summaryJson.sourceName,
        date: summaryJson.date ? new Date(summaryJson.date) : null,
        bullets: summaryJson.bullets,
        quote: summaryJson.quote,
        links: summaryJson.links,
        impact: summaryJson.impact,
      },
    });

    return summary;
  } catch (error) {
    console.error(`Failed to summarize article ${articleId}:`, error);
    // Log error and allow the run to continue
    return null;
  }
}
