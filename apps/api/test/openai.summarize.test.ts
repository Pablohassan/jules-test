import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Summarize from '@/services/summarize/openai'

// Mock Prisma to avoid DB writes
vi.mock('@prisma/client', () => ({
  default: {
    PrismaClient: class {
      summary = { create: vi.fn(async (args: any) => ({ id: 'sum1', ...args.data })) }
    },
  },
}))

// Mock OpenAI client constructor and method
vi.mock('openai', () => {
  class FakeOpenAI {
    chat = {
      completions: {
        create: vi.fn(async () => ({
          choices: [ { message: { content: JSON.stringify({
            title: 'T', sourceName: 'S', date: null, bullets: ['1','2','3','4','5'], quote: 'q', links: []
          }) } } ]
        }) )
      }
    }
    constructor(_cfg: any) {}
  }
  return { default: FakeOpenAI }
})

describe('summarizeArticle', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns null if OPENAI_API_KEY missing', async () => {
    const old = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    const res = await Summarize.summarizeArticle('a1', 'content', { title: 't' })
    expect(res).toBeNull()
    if (old) process.env.OPENAI_API_KEY = old
  })

  it('creates a summary when API key present', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    const res = await Summarize.summarizeArticle('a1', 'content', { title: 't', sourceName: 's' })
    expect(res).not.toBeNull()
    expect(res?.title).toBe('T')
  })
})
