import { describe, it, expect } from 'vitest'
import type { Payload } from '@brief/schema'
import { buildDocumentEntries, filterEntries } from '@/features/palette'
import type { PaletteEntry, PaletteGroup } from '@/features/palette'

const payload: Payload = {
  meta: { title: 'Rate limits' },
  sections: [
    {
      id: 'why',
      no: 1,
      title: 'Why we need limits',
      blocks: [
        {
          type: 'code',
          language: 'ts',
          filename: 'src/limiter.ts',
          code: 'const limiter = env.LIMITER\n\n  await limiter.limit({ key })',
        },
      ],
    },
    {
      id: 'cost',
      no: 2,
      title: 'ต้นทุนเมื่อ n โต',
      blocks: [
        {
          type: 'table',
          caption: 'Backends',
          head: ['Backend', 'Accuracy'],
          rows: [
            ['Rate limiting binding', '±5%'],
            ['Durable Object', 'exact'],
          ],
        },
      ],
    },
  ],
  decisions: [
    {
      id: 'D1',
      q: 'Which backend enforces the quota?',
      multi: false,
      opts: [
        { id: 'a', label: 'Rate limiting binding' },
        { id: 'b', label: 'Durable Object' },
      ],
    },
    {
      id: 'D2',
      q: 'ค่า default limit ต่อผู้ใช้',
      multi: false,
      opts: [
        { id: 'a', label: '100 per minute' },
        { id: 'b', label: '1000 per hour' },
      ],
    },
  ],
}

const copyPrompt: PaletteEntry = { kind: 'action', key: 'a:copy', label: 'Copy prompt with answers', run: () => {} }

function summary(groups: PaletteGroup[]) {
  return groups.map((group) => [group.title, group.entries.map((entry) => entry.label)])
}

describe('palette entries', () => {
  const entries = [copyPrompt, ...buildDocumentEntries(payload)]

  it('builds one entry per section, decision and visible block string, skipping blank lines', () => {
    expect(buildDocumentEntries(payload)).toEqual([
      {
        kind: 'decision',
        key: 'd:D1',
        decisionId: 'D1',
        label: 'Which backend enforces the quota?',
        keywords: 'D1 Rate limiting binding Durable Object',
      },
      {
        kind: 'decision',
        key: 'd:D2',
        decisionId: 'D2',
        label: 'ค่า default limit ต่อผู้ใช้',
        keywords: 'D2 100 per minute 1000 per hour',
      },
      { kind: 'section', key: 's:why', sectionId: 'why', sectionNo: 1, label: 'Why we need limits' },
      { kind: 'block', key: 'b:0:0:0', tag: 'code', label: 'src/limiter.ts', sectionId: 'why', sectionNo: 1 },
      { kind: 'block', key: 'b:0:0:1', tag: 'code', label: 'const limiter = env.LIMITER', sectionId: 'why', sectionNo: 1 },
      { kind: 'block', key: 'b:0:0:2', tag: 'code', label: 'await limiter.limit({ key })', sectionId: 'why', sectionNo: 1 },
      { kind: 'section', key: 's:cost', sectionId: 'cost', sectionNo: 2, label: 'ต้นทุนเมื่อ n โต' },
      { kind: 'block', key: 'b:1:0:0', tag: 'table', label: 'Backends', sectionId: 'cost', sectionNo: 2 },
      { kind: 'block', key: 'b:1:0:1', tag: 'table', label: 'Backend Accuracy', sectionId: 'cost', sectionNo: 2 },
      { kind: 'block', key: 'b:1:0:2', tag: 'table', label: 'Rate limiting binding ±5%', sectionId: 'cost', sectionNo: 2 },
      { kind: 'block', key: 'b:1:0:3', tag: 'table', label: 'Durable Object exact', sectionId: 'cost', sectionNo: 2 },
    ])
  })

  it('lists decisions, sections and actions for an empty or whitespace query, never blocks', () => {
    const expected = [
      ['DECISIONS', ['Which backend enforces the quota?', 'ค่า default limit ต่อผู้ใช้']],
      ['SECTIONS', ['Why we need limits', 'ต้นทุนเมื่อ n โต']],
      ['ACTIONS', ['Copy prompt with answers']],
    ]
    expect(summary(filterEntries(entries, ''))).toEqual(expected)
    expect(summary(filterEntries(entries, '   '))).toEqual(expected)
  })

  it('orders groups Decisions, Blocks, Sections, Actions whatever the input order', () => {
    expect(summary(filterEntries(entries, 'i'))).toEqual([
      ['DECISIONS', ['Which backend enforces the quota?', 'ค่า default limit ต่อผู้ใช้']],
      [
        'BLOCKS',
        ['src/limiter.ts', 'const limiter = env.LIMITER', 'await limiter.limit({ key })', 'Rate limiting binding ±5%'],
      ],
      ['SECTIONS', ['Why we need limits']],
      ['ACTIONS', ['Copy prompt with answers']],
    ])
  })

  it.each([
    ['a code line', 'LIMIT({', [['BLOCKS', ['await limiter.limit({ key })']]]],
    ['a table row', '±5%', [['BLOCKS', ['Rate limiting binding ±5%']]]],
    ['a decision id', 'd2', [['DECISIONS', ['ค่า default limit ต่อผู้ใช้']]]],
    ['an option label', 'per hour', [['DECISIONS', ['ค่า default limit ต่อผู้ใช้']]]],
    ['a Thai substring', 'ผู้ใช้', [['DECISIONS', ['ค่า default limit ต่อผู้ใช้']]]],
    ['a zero-padded section number', '02', [['SECTIONS', ['ต้นทุนเมื่อ n โต']]]],
    [
      'text shared by an option and a table row',
      'binding',
      [
        ['DECISIONS', ['Which backend enforces the quota?']],
        ['BLOCKS', ['Rate limiting binding ±5%']],
      ],
    ],
  ])('finds %s', (_what, query, expected) => {
    expect(summary(filterEntries(entries, query))).toEqual(expected)
  })

  it('returns no groups when nothing matches', () => {
    expect(filterEntries(entries, 'quota limiter xyz')).toEqual([])
  })

  it('caps the Blocks group at 50 entries, keeping reading order', () => {
    const lines = Array.from({ length: 120 }, (_, i) => `line ${i + 1}`).join('\n')
    const long: Payload = {
      meta: { title: 'Long' },
      sections: [{ id: 'one', no: 1, title: 'One', blocks: [{ type: 'code', language: 'txt', code: lines }] }],
      decisions: [],
    }
    expect(summary(filterEntries(buildDocumentEntries(long), 'line'))).toEqual([
      ['BLOCKS', Array.from({ length: 50 }, (_, i) => `line ${i + 1}`)],
    ])
  })
})
