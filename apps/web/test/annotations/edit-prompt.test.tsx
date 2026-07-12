import { describe, it, expect } from 'vitest'
import type { Payload } from '@brief/schema'
import type { Highlight, ReaderState } from '@/features/reader-state'
import { buildEditPrompt } from '@/features/annotations'

const basePayload: Payload = {
  meta: { title: 'Rate Limiter', version: '1.2.0' },
  sections: [
    { id: 's1', no: 1, title: 'Intro', blocks: [{ type: 'p', text: 'Hello world' }] },
    {
      id: 's2',
      no: 2,
      title: 'Design',
      blocks: [{ type: 'table', head: ['A', 'B'], rows: [['a1', 'b1']] }],
    },
  ],
  decisions: [
    {
      id: 'd1',
      q: 'Which cache backend?',
      multi: false,
      opts: [
        { id: 'kv', label: 'Cloudflare KV' },
        { id: 'none', label: 'No cache' },
      ],
    },
  ],
}

function emptyState(overrides: Partial<ReaderState> = {}): ReaderState {
  return { highlights: [], dsel: {}, dnote: {}, ...overrides }
}

describe('buildEditPrompt', () => {
  it('returns null when there are no highlights and no decision has been touched', () => {
    const prompt = buildEditPrompt(basePayload, emptyState(), 'sess1', 'https://example.com', false)
    expect(prompt).toBeNull()
  })

  it('returns a prompt when a decision has a note even with no selection', () => {
    const state = emptyState({ dnote: { d1: 'needs low latency' } })
    const prompt = buildEditPrompt(basePayload, state, 'sess1', 'https://example.com', false)
    expect(prompt).not.toBeNull()
  })

  it('returns a prompt when a decision has been answered even with no highlights', () => {
    const state = emptyState({ dsel: { d1: ['kv'] } })
    const prompt = buildEditPrompt(basePayload, state, 'sess1', 'https://example.com', false)
    expect(prompt).not.toBeNull()
  })

  it('includes the doc title, session id, and reference URL', () => {
    const state = emptyState({ dsel: { d1: ['kv'] } })
    const prompt = buildEditPrompt(basePayload, state, 'sess1', 'https://example.com', false)
    expect(prompt).toContain('"Rate Limiter"')
    expect(prompt).toContain('session sess1')
    expect(prompt).toContain('Reference: https://example.com/s/sess1')
  })

  it('emits the /raw markdown source URL for a plain session', () => {
    const state = emptyState({ dsel: { d1: ['kv'] } })
    const prompt = buildEditPrompt(basePayload, state, 'sess1', 'https://example.com', false)
    expect(prompt).toContain('/api/session/sess1/raw')
  })

  it('does not emit the raw URL for an encrypted session, and instructs pasting instead', () => {
    const state = emptyState({ dsel: { d1: ['kv'] } })
    const prompt = buildEditPrompt(basePayload, state, 'sess1', 'https://example.com', true)
    expect(prompt).not.toBeNull()
    expect(prompt).not.toContain('/raw')
    expect(prompt).not.toContain('/api/session')
    expect(prompt).toMatch(/paste the current document/i)
    expect(prompt).toMatch(/encrypted/i)
  })

  it('includes every highlight with its anchor, quoted text, note, and question', () => {
    const highlights: Highlight[] = [
      { id: 'h1', sid: 0, bid: 0, start: 0, end: 5, text: 'Hello', note: 'change this to xyz', question: undefined },
      { id: 'h2', sid: 1, bid: 0, path: 'rows.0.1', start: 0, end: 2, text: 'b1', note: null, question: 'why this value?' },
      { id: 'h3', sid: 0, bid: null, start: 0, end: 4, text: 'Head', note: null },
    ]
    const state = emptyState({ highlights })
    const prompt = buildEditPrompt(basePayload, state, 'sess1', 'https://example.com', false)!

    // Highlight 1: section, block, note.
    expect(prompt).toContain('section 01 "Intro"')
    expect(prompt).toContain('block 1')
    expect(prompt).toContain('chars 0-5')
    expect(prompt).toContain('Quoted: "Hello"')
    expect(prompt).toContain('Edit request: change this to xyz')

    // Highlight 2: table leaf path, question.
    expect(prompt).toContain('section 02 "Design"')
    expect(prompt).toContain('block 1 (rows.0.1)')
    expect(prompt).toContain('Quoted: "b1"')
    expect(prompt).toContain('Reader question: why this value?')

    // Highlight 3: heading location, bare highlight labeled distinctly from a note/question.
    expect(prompt).toContain('heading')
    expect(prompt).toContain('Quoted: "Head"')
    expect(prompt).toMatch(/highlighted only, no note or question/i)
  })

  it('distinguishes a bare highlight from one with a note in the same prompt', () => {
    const highlights: Highlight[] = [
      { id: 'h1', sid: 0, bid: 0, start: 0, end: 5, text: 'Hello', note: 'change this', question: undefined },
      { id: 'h2', sid: 0, bid: 0, start: 0, end: 5, text: 'Plain', note: null, question: undefined },
    ]
    const state = emptyState({ highlights })
    const prompt = buildEditPrompt(basePayload, state, 'sess1', 'https://example.com', false)!
    const lines = prompt.split('\n')

    const noteLineIndex = lines.findIndex((l) => l.includes('Edit request: change this'))
    const bareLineIndex = lines.findIndex((l) => l.includes('highlighted only'))
    expect(noteLineIndex).toBeGreaterThan(-1)
    expect(bareLineIndex).toBeGreaterThan(-1)
    // The bare highlight's own block must not also claim a note/edit request.
    expect(lines[bareLineIndex - 1]).toContain('Quoted: "Plain"')
  })

  it('includes decision answers and notes, matching the resolved-label serialization', () => {
    const state = emptyState({ dsel: { d1: ['kv'] }, dnote: { d1: 'needs low latency' } })
    const prompt = buildEditPrompt(basePayload, state, 'sess1', 'https://example.com', false)!
    expect(prompt).toContain('[d1] Which cache backend?')
    expect(prompt).toContain('- Choice: Cloudflare KV')
    expect(prompt).toContain('- Note: needs low latency')
  })

  it('marks an unanswered decision as "(not answered)" when another decision has input', () => {
    const twoDecisions: Payload = {
      ...basePayload,
      decisions: [
        ...basePayload.decisions,
        { id: 'd2', q: 'Which region?', multi: false, opts: [{ id: 'us', label: 'US' }] },
      ],
    }
    const state = emptyState({ dsel: { d1: ['kv'] } })
    const prompt = buildEditPrompt(twoDecisions, state, 'sess1', 'https://example.com', false)!
    expect(prompt).toContain('[d2] Which region?')
    expect(prompt).toContain('- Choice: (not answered)')
  })

  it('omits the Decisions section entirely when the payload has no decisions', () => {
    const noDecisions: Payload = { ...basePayload, decisions: [] }
    const highlights: Highlight[] = [
      { id: 'h1', sid: 0, bid: 0, start: 0, end: 5, text: 'Hello', note: 'change this', question: undefined },
    ]
    const prompt = buildEditPrompt(noDecisions, emptyState({ highlights }), 'sess1', 'https://example.com', false)!
    expect(prompt).not.toContain('Decisions:')
  })

  it('closes with an instruction to publish a new Brief rather than mutate this session', () => {
    const state = emptyState({ dsel: { d1: ['kv'] } })
    const prompt = buildEditPrompt(basePayload, state, 'sess1', 'https://example.com', false)!
    expect(prompt).toMatch(/new brief/i)
    expect(prompt).toMatch(/original link stays valid/i)
  })

  it('uses only plain ASCII punctuation (no em/en dash)', () => {
    const highlights: Highlight[] = [
      { id: 'h1', sid: 0, bid: 0, start: 0, end: 5, text: 'Hello', note: 'change this', question: 'why?' },
    ]
    const state = emptyState({ highlights, dsel: { d1: ['kv'] } })
    const prompt = buildEditPrompt(basePayload, state, 'sess1', 'https://example.com', false)!
    expect(prompt).not.toMatch(/[–—]/)
  })
})
