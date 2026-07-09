import { describe, it, expect } from 'vitest'
import { payloadSchema, MAX_PAYLOAD_BYTES } from '../src'

const minimal = {
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
    const bad = structuredClone(minimal)
    // @ts-expect-error testing invalid block type
    bad.sections[0].blocks = [{ type: 'blink', text: 'x' }]
    expect(payloadSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts every interactive and chart block type', () => {
    const full = structuredClone(minimal) as typeof minimal
    full.sections[0]!.blocks = [
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
    ] as any
    const parsed = payloadSchema.safeParse(full)
    expect(parsed.success).toBe(true)
  })

  it('rejects bigo curves outside the enum (no eval surface)', () => {
    const bad = structuredClone(minimal)
    // @ts-expect-error testing invalid bigo curve
    bad.sections[0].blocks = [{ type: 'bigo', series: [{ label: 'x', curve: 'process.exit()' }] }]
    expect(payloadSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts decisions with options and flags', () => {
    const withDecision = structuredClone(minimal) as typeof minimal
    withDecision.decisions = [
      { id: 'd1', q: 'Which cache?', multi: false, opts: [{ id: 'kv', label: 'KV' }, { id: 'none', label: 'None' }], why: 'Latency' },
    ] as any
    expect(payloadSchema.safeParse(withDecision).success).toBe(true)
  })

  it('exports the size cap', () => {
    expect(MAX_PAYLOAD_BYTES).toBe(1_900_000)
  })
})
