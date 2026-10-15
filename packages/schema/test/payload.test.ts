import { describe, it, expect } from 'vitest'
import { payloadSchema, MAX_PAYLOAD_BYTES, blockSchema, sectionSchema, decisionSchema, metaSchema, BLOCK_TYPES, BIGO_CURVES, TONES, STAT_TONES, ALIGNS, BA_SIDES, type Block, type Decision, type Payload } from '../src'

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

const chars = (n: number) => 'x'.repeat(n)
const many = <T>(n: number, item: T): T[] => Array.from({ length: n }, () => item)
const withBlock = (block: unknown): Payload => ({ ...minimal, sections: [{ ...minimal.sections[0]!, blocks: [block as Block] }] })
const decision = { id: 'd1', q: 'Which?', multi: false, opts: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }
const withRefs = (refs: string[]): Payload => ({ ...minimal, decisions: [{ ...decision, refs }] })
const withGlossary = (glossary: unknown): Payload => ({ ...minimal, glossary } as Payload)
const term = { term: 'token bucket', def: 'A counter that refills at a fixed rate.', aliases: ['bucket'] }
const code = (notes: unknown) => withBlock({ type: 'code', language: 'ts', code: 'a\nb', notes })
const ba = (extra: object) => withBlock({ type: 'ba', language: 'ts', before: 'a', after: 'b', ...extra })
const stat = (item: object, extra: object = {}) => withBlock({ type: 'stat', items: [{ label: 'RPS', value: '4,800', ...item }], ...extra })
const table = (extra: object) => withBlock({ type: 'table', head: ['a', 'b'], rows: [['1', '2']], ...extra })
const seq = (step: object) => withBlock({ type: 'seq', actors: ['web', 'api'], steps: [{ from: 'web', to: 'api', label: 'GET', ...step }] })
const histogram = (threshold: unknown) => withBlock({ type: 'histogram', bins: [{ label: '1', count: 2 }], threshold })
const state = (stateTone: unknown, transitionTone: unknown) => withBlock({
  type: 'state', initial: 'a',
  states: [{ id: 'a', label: 'A', tone: stateTone }, { id: 'b', label: 'B' }],
  transitions: [{ from: 'a', to: 'b', tone: transitionTone }],
})
const layers = (diffNode: unknown) => withBlock({ type: 'layers', layers: [{ id: 'l', label: 'L', nodes: [{ id: 'n', label: 'N', diffNode }], edges: [] }] })

/** Round 1 Console fields: each accepts a valid example and rejects one past its cap or enum. */
const fieldCases: { name: string; payload: Payload; valid: boolean }[] = [
  { name: 'decision refs', payload: withRefs(['overview']), valid: true },
  { name: 'decision refs over 6', payload: withRefs(many(7, 'overview')), valid: false },
  { name: 'glossary', payload: withGlossary([term]), valid: true },
  { name: 'glossary def over 400', payload: withGlossary([{ ...term, def: chars(401) }]), valid: false },
  { name: 'glossary over 60 entries', payload: withGlossary(many(61, term)), valid: false },
  { name: 'glossary aliases over 5', payload: withGlossary([{ ...term, aliases: many(6, 'b') }]), valid: false },
  { name: 'code notes', payload: code([{ from: 1, text: 'why' }, { from: 1, to: 2, text: 'range' }]), valid: true },
  { name: 'code note text over 280', payload: code([{ from: 1, text: chars(281) }]), valid: false },
  { name: 'code notes over 30', payload: code(many(31, { from: 1, text: 'n' })), valid: false },
  { name: 'code note line 0', payload: code([{ from: 0, text: 'n' }]), valid: false },
  { name: 'ba notes with a side', payload: ba({ notes: [{ side: 'after', from: 1, text: 'n' }] }), valid: true },
  { name: 'ba note without a side', payload: ba({ notes: [{ from: 1, text: 'n' }] }), valid: false },
  { name: 'ba note text over 280', payload: ba({ notes: [{ side: 'before', from: 1, text: chars(281) }] }), valid: false },
  { name: 'ba filename', payload: ba({ filename: 'src/limiter.ts' }), valid: true },
  { name: 'ba filename over 300', payload: ba({ filename: chars(301) }), valid: false },
  { name: 'stat caption', payload: stat({}, { caption: 'Flash sale' }), valid: true },
  { name: 'stat caption over 300', payload: stat({}, { caption: chars(301) }), valid: false },
  { name: 'stat spark', payload: stat({ spark: [6, 9, 7, 12, 20, 10] }), valid: true },
  { name: 'stat spark over 32 values', payload: stat({ spark: many(33, 1) }), valid: false },
  { name: 'stat spark with one value', payload: stat({ spark: [1] }), valid: false },
  { name: 'stat spark negative', payload: stat({ spark: [1, -1] }), valid: false },
  { name: 'stat hint tone', payload: stat({ hint: 'up 8x', hintTone: 'red' }), valid: true },
  { name: 'stat hint tone outside the palette', payload: stat({ hintTone: 'chartreuse' }), valid: false },
  { name: 'table align', payload: table({ align: ['left', 'right'] }), valid: true },
  { name: 'table align over 50', payload: table({ align: many(51, 'left') }), valid: false },
  { name: 'table align outside the enum', payload: table({ align: ['justify'] }), valid: false },
  { name: 'table cells', payload: table({ cells: [{ row: 1, col: 2, tone: 'good' }] }), valid: true },
  { name: 'table cells over 200', payload: table({ cells: many(201, { row: 1, col: 1, tone: 'bad' }) }), valid: false },
  { name: 'table cell row 0', payload: table({ cells: [{ row: 0, col: 1, tone: 'bad' }] }), valid: false },
  { name: 'table cell tone outside the enum', payload: table({ cells: [{ row: 1, col: 1, tone: 'red' }] }), valid: false },
  { name: 'seq step text', payload: seq({ text: 'Client sends GET /orders' }), valid: true },
  { name: 'seq step text over 300', payload: seq({ text: chars(301) }), valid: false },
  { name: 'histogram threshold', payload: histogram({ bin: 6, label: 'p95', value: '2.4 s' }), valid: true },
  { name: 'histogram threshold label over 40', payload: histogram({ bin: 6, label: chars(41) }), valid: false },
  { name: 'histogram threshold bin 0', payload: histogram({ bin: 0, label: 'p95' }), valid: false },
  { name: 'state and transition tones', payload: state('bad', 'warn'), valid: true },
  { name: 'state tone outside the enum', payload: state('error', undefined), valid: false },
  { name: 'transition tone outside the enum', payload: state(undefined, 'red'), valid: false },
  { name: 'layers node diff link', payload: layers('limiter'), valid: true },
  { name: 'layers node diff link over 300', payload: layers(chars(301)), valid: false },
]

describe('round 1 Console fields', () => {
  it.each(fieldCases)('$name: valid=$valid', ({ payload, valid }) => {
    const result = payloadSchema.safeParse(payload)
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(valid)
  })

  it('keeps every round 1 field through a parse instead of stripping it', () => {
    const parsed = payloadSchema.parse(withGlossary([term]))
    expect(parsed.glossary).toEqual([term])
    expect(payloadSchema.parse(withRefs(['overview'])).decisions[0]!.refs).toEqual(['overview'])
    const threshold = { bin: 6, label: 'p95', value: '2.4 s' }
    expect(payloadSchema.parse(histogram(threshold)).sections[0]!.blocks[0]).toMatchObject({ threshold })
  })

  it('exports the enum values the reader lanes map to tokens', () => {
    expect(TONES).toEqual(['info', 'good', 'warn', 'bad'])
    expect(STAT_TONES).toEqual(['mauve', 'blue', 'green', 'red', 'peach', 'teal', 'yellow'])
    expect(ALIGNS).toEqual(['left', 'center', 'right'])
    expect(BA_SIDES).toEqual(['before', 'after'])
  })
})
