import { Summary, Source } from '@prisma/client';

// A type alias to include the source with each summary
type SummaryWithSource = Summary & { article: { source: Source } };

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function buildMarkdown(summaries: SummaryWithSource[], useParagraphs:boolean = false): string {
  const weekNumber = getISOWeek(new Date());
  let markdown = `
# Veille IA — Semaine ${weekNumber}

## ${summaries.length} articles analysés cette semaine.

---
`;

  for (const summary of summaries) {
    const bullets = (summary.bullets as unknown as string[]) || [];
    
    // For magazine style: create flowing paragraphs from bullets
    const content = useParagraphs
      ? bullets.join(' ') // Join bullets into flowing paragraph
      : bullets.map(b => `- ${b}`).join('\n'); // Keep classic bullet list

    markdown += `
## ${summary.title}

**Source:** ${summary.sourceName}
**Date:** ${summary.date ? new Date(summary.date).toLocaleDateString('fr-FR') : 'N/A'}
**Lien:** ${summary.article.source.url}

${content}

> "${summary.quote}"

---
`;
  }

  markdown += `
# Synthèse

## Prochaines étapes et veille continue.
`;

  return markdown;
}
