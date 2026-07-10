import { describe, it, expect } from 'vitest'
import { payloadSchema, MAX_PAYLOAD_BYTES, blockSchema, sectionSchema, decisionSchema, metaSchema, BLOCK_TYPES, BIGO_CURVES, type Block, type Decision, type Payload } from '../src'

const minimal: Payload = {
  meta: { title: 'PR 42 review' },
  sections: [
    { id: 'overview', no: 1, title: 'Overview', blocks: [{ type: 'p', text: 'hello' }] },
  ],
  decisions: [],
}

describe('payloadSchema', () => {
  it('accepts a minimal valid payload', () => {
    expect(payloadSchema.safeParse(minimal).success).toBe(true)
  })

  it('rejects unknown block types', () => {
    const bad = structuredClone(minimal) as Payload
    // @ts-expect-error testing invalid block type
    bad.sections[0].blocks = [{ type: 'blink', text: 'x' }]
    expect(payloadSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts every interactive and chart block type', () => {
    const full = structuredClone(minimal) as Payload
    const blocks: Block[] = [
      { type: 'note', text: 'n' },
      { type: 'warn', text: 'w' },
      { type: 'good', text: 'g' },
      { type: 'table', head: ['a'], rows: [['1']] },
      { type: 'compare', left: { title: 'A', items: [{ text: 'x', ok: true }] }, right: { title: 'B', items: [{ text: 'y', ok: false }] } },
      { type: 'stat', items: [{ label: 'files', value: '12' }] },
      { type: 'coverage', items: [{ label: 'auth', status: 'partial' }] },
      { type: 'details', summary: 'more', blocks: [{ type: 'p', text: 'inner' }] },
      { type: 'seq', actors: ['web', 'api'], steps: [{ from: 'web', to: 'api', label: 'POST /session' }] },
      { type: 'state', initial: 'draft', states: [{ id: 'draft', label: 'Draft' }, { id: 'live', label: 'Live' }], transitions: [{ from: 'draft', to: 'live', label: 'publish' }] },
      { type: 'layers', layers: [{ id: 'ui', label: 'UI', nodes: [{ id: 'web', label: 'Web' }], edges: [] }] },
      { type: 'ba', language: 'ts', before: 'let a', after: 'const a' },
      { type: 'bigo', series: [{ label: 'quick sort', curve: 'nlogn' }] },
      { type: 'code', language: 'ts', code: 'export {}' },
      { type: 'mermaid', code: 'graph TD; a-->b' },
      { type: 'math', latex: 'E = mc^2' },
      { type: 'erd', tables: [{ name: 'sessions', columns: [{ name: 'id', type: 'text', pk: true }] }] },
      { type: 'heatmap', xLabels: ['mon'], yLabels: ['api'], values: [[3]] },
      { type: 'histogram', bins: [{ label: '0-10ms', count: 4 }] },
      { type: 'scatter', series: [{ label: 'v1', points: [[1, 2]] }] },
      { type: 'plot3d', kind: 'scatter3d', points: [[1, 2, 3]] },
    ]
    full.sections[0]!.blocks = blocks
    const parsed = payloadSchema.safeParse(full)
    expect(parsed.success).toBe(true)
  })

  it('accepts compare blocks with optional caption, side tone, and side tag', () => {
    const withExtras = structuredClone(minimal) as Payload
    withExtras.sections[0]!.blocks = [
      {
        type: 'compare',
        caption: 'Before vs after',
        left: { title: 'A', tone: 'good', tag: 'Recommended', items: [{ text: 'x', ok: true }] },
        right: { title: 'B', tone: 'bad', items: [{ text: 'y', ok: false }] },
      },
    ]
    expect(payloadSchema.safeParse(withExtras).success).toBe(true)
  })

  it('rejects compare side tone outside the good/bad enum', () => {
    const bad = structuredClone(minimal) as Payload
    bad.sections[0]!.blocks = [
      {
        type: 'compare',
        left: { title: 'A', tone: 'ugly', items: [{ text: 'x', ok: true }] },
        right: { title: 'B', items: [{ text: 'y', ok: false }] },
      },
    ] as never
    expect(payloadSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts stat items with optional tone', () => {
    const withTone = structuredClone(minimal) as Payload
    withTone.sections[0]!.blocks = [
      { type: 'stat', items: [{ label: 'files', value: '12', tone: 'green' }] },
    ]
    expect(payloadSchema.safeParse(withTone).success).toBe(true)
  })

  it('rejects stat item tone outside the palette enum', () => {
    const bad = structuredClone(minimal) as Payload
    bad.sections[0]!.blocks = [
      { type: 'stat', items: [{ label: 'files', value: '12', tone: 'chartreuse' }] },
    ] as never
    expect(payloadSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts coverage blocks with an optional caption', () => {
    const withCaption = structuredClone(minimal) as Payload
    withCaption.sections[0]!.blocks = [
      { type: 'coverage', caption: 'Test coverage', items: [{ label: 'auth', status: 'full' }] },
    ]
    expect(payloadSchema.safeParse(withCaption).success).toBe(true)
  })

  it('rejects bigo curves outside the enum (no eval surface)', () => {
    const bad = structuredClone(minimal) as Payload
    // @ts-expect-error testing invalid bigo curve
    bad.sections[0].blocks = [{ type: 'bigo', series: [{ label: 'x', curve: 'process.exit()' }] }]
    expect(payloadSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts decisions with options and flags', () => {
    const withDecision = structuredClone(minimal) as Payload
    const decisions: Decision[] = [
      { id: 'd1', q: 'Which cache?', multi: false, opts: [{ id: 'kv', label: 'KV' }, { id: 'none', label: 'None' }], why: 'Latency' },
    ]
    withDecision.decisions = decisions
    expect(payloadSchema.safeParse(withDecision).success).toBe(true)
  })

  it('exports the size cap', () => {
    expect(MAX_PAYLOAD_BYTES).toBe(1_900_000)
  })

  it('exports schema builders directly', () => {
    const block = blockSchema.safeParse({ type: 'p', text: 'test' })
    expect(block.success).toBe(true)

    const section = sectionSchema.safeParse({
      id: 's1',
      no: 1,
      title: 'Test',
      blocks: [{ type: 'p', text: 'hello' }],
    })
    expect(section.success).toBe(true)

    const decision = decisionSchema.safeParse({
      id: 'd1',
      q: 'Test?',
      multi: false,
      opts: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    })
    expect(decision.success).toBe(true)

    const meta = metaSchema.safeParse({ title: 'My Doc' })
    expect(meta.success).toBe(true)
  })

  it('exports BLOCK_TYPES array with 22 types', () => {
    expect(BLOCK_TYPES).toHaveLength(22)
    expect(BLOCK_TYPES).toContain('p')
    expect(BLOCK_TYPES).toContain('details')
    expect(BLOCK_TYPES).toContain('plot3d')
  })

  it('exports BIGO_CURVES enum', () => {
    expect(BIGO_CURVES).toEqual(['1', 'logn', 'sqrt', 'n', 'nlogn', 'n2', 'n3', '2n'])
  })

  it('rejects details block nested inside details block', () => {
    const bad = structuredClone(minimal) as Payload
    // @ts-expect-error testing invalid nested details
    bad.sections[0].blocks = [
      {
        type: 'details',
        summary: 'outer',
        blocks: [
          {
            type: 'details',
            summary: 'inner',
            blocks: [{ type: 'p', text: 'nested' }],
          },
        ],
      },
    ] as never
    expect(payloadSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts meta with optional docId and subtitle', () => {
    const withMeta = structuredClone(minimal) as Payload
    withMeta.meta.docId = 'DOC-018 · RATE-LIMIT'
    withMeta.meta.subtitle = 'How to choose'
    expect(payloadSchema.safeParse(withMeta).success).toBe(true)
  })

  it('rejects non-string docId', () => {
    const bad = structuredClone(minimal) as Payload
    // @ts-expect-error testing invalid docId type
    bad.meta.docId = 123
    expect(payloadSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects non-string subtitle', () => {
    const bad = structuredClone(minimal) as Payload
    // @ts-expect-error testing invalid subtitle type
    bad.meta.subtitle = true
    expect(payloadSchema.safeParse(bad).success).toBe(false)
  })
})
