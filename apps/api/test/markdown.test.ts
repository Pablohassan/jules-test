import { describe, it, expect } from 'vitest'
import { buildMarkdown } from '@/services/gamma/markdown'

describe('buildMarkdown', () => {
  it('renders a weekly header and summaries', () => {
    const summaries: any = [
      {
        id: 's1',
        title: 'Titre 1',
        sourceName: 'Site 1',
        date: new Date().toISOString(),
        bullets: ['a', 'b', 'c', 'd', 'e'],
        quote: 'citation',
        links: [],
        article: { source: { url: 'https://exemple.com' } },
      },
    ]
    const md = buildMarkdown(summaries)
    expect(md).toContain('Veille IA — Semaine')
    expect(md).toContain('## Titre 1')
    expect(md).toContain('**Source:** Site 1')
    expect(md).toContain('- a')
  })
})

