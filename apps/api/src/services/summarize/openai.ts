import OpenAI from "openai";
import prismaPkg from "@prisma/client";
const { PrismaClient } = prismaPkg as typeof import("@prisma/client");

const prisma = new PrismaClient();

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing. Set it to enable summarization."
    );
  }
  return new OpenAI({ apiKey });
}

const SYSTEM_PROMPT = `
You are an expert summarizer for an AI-powered news watch.
Your task is to generate a structured JSON summary from the provided article text.
The JSON output must strictly adhere to the following format:
{
  "title": "string",
  "sourceName": "string",
  "date": "ISO 8601 date string or null",
  "bullets": ["string", "string", "string", "string", "string"],
  "quote": "string (max 100 words)",
  "links": ["url", "url"],
  "impact": "string (optional, 3-4 sentences targeting SMEs/industry)"
}

Constraints:
- 'bullets' must contain exactly 5 concise points in French.
- 'quote' must be a direct quote from the article, no longer than 50 words.
- 'links' must contain a maximum of 2 relevant URLs found in the article.
- All text should be in French.
`;

export async function summarizeArticle(
  articleId: string,
  textMd: string,
  meta: { title?: string; sourceName?: string; date?: Date; additionalContext?: string }
) {
  try {
    const openai = getOpenAI();
    // Enforce GPT‑5 family as requested
    const configuredModel = process.env.OPENAI_MODEL || "gpt-5-mini";
    const model = configuredModel.startsWith("gpt-5")
      ? configuredModel
      : "gpt-5-mini";

    // Guard against context overflow: approximate by characters (1 token ~ 4 chars)
    const MAX_CHARS = Number(process.env.OPENAI_MAX_CHARS || 250000); // ~50k tokens
    const content =
      textMd.length > MAX_CHARS ? textMd.slice(0, MAX_CHARS) : textMd;
    const dateStr = meta.date ? new Date(meta.date).toISOString() : "";
    
    // Detect style preference from context
    let styleInstruction = "";
    let systemPrompt = SYSTEM_PROMPT;

    if (meta.additionalContext && (meta.additionalContext.toLowerCase().includes("magazine") || meta.additionalContext.toLowerCase().includes("paragraph") || meta.additionalContext.toLowerCase().includes("avoid bullet"))) {
      styleInstruction = "IMPORTANT: Write the 5 bullets as full, flowing sentences that can be joined to form a cohesive paragraph. Avoid fragmented or dry bullet-style writing. Each point should flow naturally into the next. AIM FOR DEPTH: Each point should be a substantial paragraph of 50-80 words.";
      
      // Relax system constraints for magazine style
      systemPrompt = systemPrompt.replace(
        "- 'bullets' must contain exactly 5 concise points in French.",
        "- 'bullets' must contain exactly 5 detailed, well-developed paragraphs in French. Each paragraph should be substantial (50-80 words) to provide depth and context."
      );
    }

    const userPrompt = `Summarize the following article (the text may be truncated for length):
    
Title: ${meta.title}
Source: ${meta.sourceName}
Date: ${dateStr}

${styleInstruction}

Context: ${meta.additionalContext || "None"}

Article Content:
${content}`;

    const response = await withOpenAIRetry(async () => {
      return openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        response_format: { type: "json_object" },
      });
    });

    const summaryJson = JSON.parse(response.choices[0].message.content || "{}");

    // Basic validation
    if (
      !summaryJson.title ||
      !summaryJson.sourceName ||
      !Array.isArray(summaryJson.bullets) ||
      summaryJson.bullets.length !== 5
    ) {
      throw new Error("Invalid JSON format received from OpenAI");
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

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Basic retry with exponential backoff for 429/5xx. Do not retry on hard quota.
async function withOpenAIRetry<T>(fn: () => Promise<T>): Promise<T> {
  const maxAttempts = Number(process.env.OPENAI_RETRY_ATTEMPTS || 3);
  const baseDelay = Number(process.env.OPENAI_RETRY_BASE_MS || 500);
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const status = e?.status || e?.response?.status;
      const code = e?.error?.code || e?.code;
      const msg = e?.message || "";
      const retryable = status === 429 || (status >= 500 && status < 600);
      const hardQuota =
        code === "insufficient_quota" ||
        /insufficient_quota|billing|quota/i.test(msg);
      if (hardQuota) break;
      if (!retryable || attempt === maxAttempts) break;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  throw lastErr;
}
