import { describe, it, expect } from 'vitest'
import { parseStoredPayload, payloadToMarkdown, type Payload } from '../src'

const payload: Payload = {
  meta: { title: 'Cache design', author: 'Claude' },
  sections: [
    {
      id: 's1', no: 1, title: 'Flow',
      blocks: [
        { type: 'p', text: 'Requests hit the edge first.' },
        { type: 'warn', text: 'KV is eventually consistent.' },
        { type: 'seq', actors: ['web', 'api'], steps: [{ from: 'web', to: 'api', label: 'GET /session' }] },
        { type: 'code', language: 'ts', code: 'export const a = 1' },
        { type: 'math', latex: 'O(n \\log n)' },
        { type: 'table', head: ['name'], rows: [['kv']] },
      ],
    },
  ],
  decisions: [
    { id: 'd1', q: 'Cache TTL?', multi: false, opts: [{ id: 'short', label: '1 hour' }, { id: 'long', label: '1 day' }] },
  ],
}

describe('payloadToMarkdown', () => {
  const md = payloadToMarkdown(payload, { url: 'https://brief.algoryth.me/s/abc' })

  it('starts with a self-describing agent header', () => {
    expect(md.startsWith('<!--')).toBe(true)
    expect(md).toContain('complete machine-readable source')
    expect(md).toContain('https://brief.algoryth.me/s/abc')
  })

  it('renders sections as numbered headings', () => {
    expect(md).toContain('## 1. Flow')
  })

  it('renders callouts as github alerts', () => {
    expect(md).toContain('> [!WARNING]')
  })

  it('renders seq blocks as real mermaid', () => {
    expect(md).toContain('```mermaid')
    expect(md).toContain('sequenceDiagram')
    expect(md).toContain('web->>api: GET /session')
  })

  it('renders code with language fence', () => {
    expect(md).toContain('```ts')
  })

  it('renders math as display latex', () => {
    expect(md).toContain('$$\nO(n \\log n)\n$$')
  })

  it('renders tables as github tables', () => {
    expect(md).toContain('| name |')
  })

  it('renders decisions with option ids', () => {
    expect(md).toContain('## Decisions')
    expect(md).toContain('Cache TTL?')
    expect(md).toContain('- [ ] `short` 1 hour')
  })

  it('renders docId in meta table when present', () => {
    const withDocId = structuredClone(payload)
    withDocId.meta.docId = 'DOC-018 · RATE-LIMIT'
    const md = payloadToMarkdown(withDocId, { url: 'https://brief.algoryth.me/s/abc' })
    expect(md).toContain('| doc | DOC-018 · RATE-LIMIT |')
  })

  it('renders subtitle paragraph after H1 when present', () => {
    const withSubtitle = structuredClone(payload)
    withSubtitle.meta.subtitle = 'How to choose'
    const md = payloadToMarkdown(withSubtitle, { url: 'https://brief.algoryth.me/s/abc' })
    // Subtitle should appear after the title (H1) and before sections
    const titleIdx = md.indexOf('# Cache design')
    const subtitleIdx = md.indexOf('How to choose')
    const firstSectionIdx = md.indexOf('## 1. Flow')
    expect(titleIdx).toBeGreaterThanOrEqual(0)
    expect(subtitleIdx).toBeGreaterThan(titleIdx)
    expect(firstSectionIdx).toBeGreaterThan(subtitleIdx)
  })

  it('renders a subtitle containing a pipe character literally, unescaped', () => {
    const withPipeSubtitle = structuredClone(payload)
    withPipeSubtitle.meta.subtitle = 'A | B'
    const md = payloadToMarkdown(withPipeSubtitle, { url: 'https://brief.algoryth.me/s/abc' })
    expect(md).toContain('A | B')
    expect(md).not.toContain('A \\| B')
  })
})

describe('mermaid block keywords', () => {
  const mkPayload = (block: Payload['sections'][number]['blocks'][number]): Payload => ({
    meta: { title: 'Diagrams' },
    sections: [{ id: 's1', no: 1, title: 'Diagrams', blocks: [block] }],
    decisions: [],
  })

  it('renders state blocks with the stateDiagram-v2 keyword', () => {
    const md = payloadToMarkdown(
      mkPayload({
        type: 'state',
        initial: 'idle',
        states: [{ id: 'idle', label: 'Idle' }, { id: 'busy', label: 'Busy' }],
        transitions: [{ from: 'idle', to: 'busy', label: 'start' }],
      }),
      { url: 'https://example.test' },
    )
    expect(md).toContain('```mermaid')
    expect(md).toContain('stateDiagram-v2')
  })

  it('renders layers blocks with the flowchart TD keyword', () => {
    const md = payloadToMarkdown(
      mkPayload({
        type: 'layers',
        layers: [{
          id: 'l1', label: 'Layer 1',
          nodes: [{ id: 'n1', label: 'Node 1' }],
          edges: [],
        }],
      }),
      { url: 'https://example.test' },
    )
    expect(md).toContain('```mermaid')
    expect(md).toContain('flowchart TD')
  })

  it('renders erd blocks with the erDiagram keyword', () => {
    const md = payloadToMarkdown(
      mkPayload({
        type: 'erd',
        tables: [{
          name: 'users',
          columns: [{ name: 'id', type: 'uuid', pk: true }],
        }],
      }),
      { url: 'https://example.test' },
    )
    expect(md).toContain('```mermaid')
    expect(md).toContain('erDiagram')
  })
})

describe('additive tone/tag/caption fields', () => {
  const mkPayload = (block: Payload['sections'][number]['blocks'][number]): Payload => ({
    meta: { title: 'Fields' },
    sections: [{ id: 's1', no: 1, title: 'Fields', blocks: [block] }],
    decisions: [],
  })

  it('prefixes a compare block caption as a bold line before the sides', () => {
    const md = payloadToMarkdown(
      mkPayload({
        type: 'compare',
        caption: 'Before vs after',
        left: { title: 'A', items: [{ text: 'x', ok: true }] },
        right: { title: 'B', items: [{ text: 'y', ok: false }] },
      }),
      { url: 'https://example.test' },
    )
    expect(md).toContain('**Before vs after**\n\n')
    expect(md.indexOf('**Before vs after**')).toBeLessThan(md.indexOf('**A**'))
  })

  it('renders no caption line when a compare block has none', () => {
    const md = payloadToMarkdown(
      mkPayload({
        type: 'compare',
        left: { title: 'A', items: [{ text: 'x', ok: true }] },
        right: { title: 'B', items: [{ text: 'y', ok: false }] },
      }),
      { url: 'https://example.test' },
    )
    expect(md).not.toContain('**undefined**')
  })

  it('appends the side tag in parentheses to a compare side heading', () => {
    const md = payloadToMarkdown(
      mkPayload({
        type: 'compare',
        left: { title: 'A', tag: 'Recommended', items: [{ text: 'x', ok: true }] },
        right: { title: 'B', items: [{ text: 'y', ok: false }] },
      }),
      { url: 'https://example.test' },
    )
    expect(md).toContain('A (Recommended)')
    expect(md).not.toContain('B (')
  })

  it('does not emit stat tone in markdown (visual-only field)', () => {
    const md = payloadToMarkdown(
      mkPayload({ type: 'stat', items: [{ label: 'files', value: '12', tone: 'green' }] }),
      { url: 'https://example.test' },
    )
    expect(md).not.toContain('green')
  })

  it('prefixes a coverage block caption as a bold line before the rows', () => {
    const md = payloadToMarkdown(
      mkPayload({
        type: 'coverage',
        caption: 'Test coverage',
        items: [{ label: 'auth', status: 'full' }],
      }),
      { url: 'https://example.test' },
    )
    expect(md).toContain('**Test coverage**\n\n')
    expect(md.indexOf('**Test coverage**')).toBeLessThan(md.indexOf('auth'))
  })
})

describe('injection hardening', () => {
  it('fences a code block containing a literal triple-backtick without corrupting the document', () => {
    const md = payloadToMarkdown(
      {
        meta: { title: 'Fence test' },
        sections: [{
          id: 's1', no: 1, title: 'Code',
          blocks: [
            { type: 'code', language: 'md', code: 'before\n```\nafter-the-fence-marker\n```\nstill inside' },
            { type: 'p', text: 'TRAILING_CONTENT_MARKER' },
          ],
        }],
        decisions: [],
      },
      { url: 'https://example.test' },
    )
    expect(md).toContain('````md')
    expect(md).toContain('still inside')
    // The trailing block must remain a sibling block, not get swallowed by an
    // early-closed fence: the whole document must still parse as one
    // 4-backtick fenced block followed by the marker outside it.
    const fenceStart = md.indexOf('````md')
    const fenceEnd = md.indexOf('````', fenceStart + 4)
    const markerIndex = md.indexOf('TRAILING_CONTENT_MARKER')
    expect(fenceEnd).toBeGreaterThan(fenceStart)
    expect(markerIndex).toBeGreaterThan(fenceEnd)
  })

  it('escapes a pipe character in a table cell', () => {
    const md = payloadToMarkdown(
      {
        meta: { title: 'Table test' },
        sections: [{
          id: 's1', no: 1, title: 'Table',
          blocks: [{ type: 'table', head: ['name'], rows: [['a|b']] }],
        }],
        decisions: [],
      },
      { url: 'https://example.test' },
    )
    expect(md).toContain('a\\|b')
  })

  it('collapses a newline in a seq step label to a single-line arrow statement', () => {
    const md = payloadToMarkdown(
      {
        meta: { title: 'Seq test' },
        sections: [{
          id: 's1', no: 1, title: 'Seq',
          blocks: [{
            type: 'seq',
            actors: ['web', 'api'],
            steps: [{ from: 'web', to: 'api', label: 'GET /session\ninjected line' }],
          }],
        }],
        decisions: [],
      },
      { url: 'https://example.test' },
    )
    const arrowLines = md.split('\n').filter((l) => l.includes('->>'))
    // If the newline in the label were preserved, "injected line" would land
    // on its own line and stop being part of the arrow statement.
    expect(arrowLines).toHaveLength(1)
    expect(arrowLines[0]).toContain('GET /session injected line')
  })

  it('emits quoted flowchart labels so brackets in a layers node label stay verbatim', () => {
    const md = payloadToMarkdown(
      {
        meta: { title: 'Layers test' },
        sections: [{
          id: 's1', no: 1, title: 'Layers',
          blocks: [{
            type: 'layers',
            layers: [{
              id: 'l1', label: 'Layer 1',
              nodes: [{ id: 'n1', label: 'Node [1]' }],
              edges: [],
            }],
          }],
        }],
        decisions: [],
      },
      { url: 'https://example.test' },
    )
    expect(md).toContain('n1["Node [1]"]')
    expect(md).toContain('subgraph l1["Layer 1"]')
  })

  it('sanitizes erd column names containing spaces or quotes into a single attribute word', () => {
    const md = payloadToMarkdown(
      {
        meta: { title: 'Erd test' },
        sections: [{
          id: 's1', no: 1, title: 'Erd',
          blocks: [{
            type: 'erd',
            tables: [{
              name: 'users',
              columns: [{ name: 'display "name', type: 'varchar(255)' }],
            }],
          }],
        }],
        decisions: [],
      },
      { url: 'https://example.test' },
    )
    const attrLine = md.split('\n').find((l) => l.includes('display'))
    expect(attrLine).toBeDefined()
    // The attribute must be a single ATTRIBUTE_WORD: no quote, no space
    // inside the sanitized name.
    expect(attrLine).toContain('display__name')
    expect(attrLine).not.toContain('"')
  })
})

describe('round 1 Console fields', () => {
  type AnyBlock = Payload['sections'][number]['blocks'][number]
  const url = { url: 'https://example.test' }
  const blockMd = (block: AnyBlock) =>
    payloadToMarkdown({ meta: { title: 'R1' }, sections: [{ id: 's1', no: 1, title: 'S', blocks: [block] }], decisions: [] }, url)
  const withDecisions = (refs: string[] | undefined, glossary?: Payload['glossary']): Payload => ({
    meta: { title: 'R1' },
    sections: [
      { id: 'bucket', no: 2, title: 'Token bucket', blocks: [{ type: 'p', text: 'x' }] },
      { id: 'kv', no: 3, title: 'KV counter', blocks: [{ type: 'p', text: 'y' }] },
    ],
    decisions: [{ id: 'D1', q: 'Which limiter?', multi: false, opts: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], refs }],
    glossary,
  })

  it('lists resolved decision refs as a Context line under the question, skipping unknown ids', () => {
    const md = payloadToMarkdown(withDecisions(['bucket', 'missing', 'kv']), url)
    expect(md).toContain('### Which limiter?\n\n(id: `D1`, single-select)\n\nContext: 02 Token bucket; 03 KV counter\n\n- [ ] `a` A')
  })

  it('prints no Context line when no ref resolves', () => {
    expect(payloadToMarkdown(withDecisions(['missing']), url)).not.toContain('Context:')
    expect(payloadToMarkdown(withDecisions(undefined), url)).not.toContain('Context:')
  })

  it('ends the export with a Glossary section after the decisions', () => {
    const md = payloadToMarkdown(withDecisions(undefined, [
      { term: 'token bucket', def: 'A counter that refills.', aliases: ['bucket', 'TB'] },
      { term: 'p95', def: 'The 95th percentile.' },
    ]), url)
    expect(md.endsWith('## Glossary\n\n- **token bucket** (also: bucket, TB): A counter that refills.\n- **p95**: The 95th percentile.\n')).toBe(true)
    expect(md.indexOf('## Decisions')).toBeLessThan(md.indexOf('## Glossary'))
    expect(payloadToMarkdown(withDecisions(undefined), url)).not.toContain('## Glossary')
  })

  it('prints code notes as agent notes under the listing', () => {
    const md = blockMd({ type: 'code', language: 'ts', code: 'a\nb', notes: [{ from: 1, text: 'why' }, { from: 1, to: 2, text: 'range' }] })
    expect(md).toContain('```ts\na\nb\n```\n\nAgent notes:\n- L1: why\n- L1-2: range')
  })

  it('prints the ba filename before the pair and each note with its side', () => {
    const md = blockMd({
      type: 'ba', language: 'ts', before: 'a', after: 'b', filename: 'src/limiter.ts',
      notes: [{ side: 'after', from: 1, to: 1, text: 'new guard' }, { side: 'before', from: 1, text: 'old bug' }],
    })
    expect(md).toContain('`src/limiter.ts`\n\n**Before**')
    expect(md).toContain('Agent notes:\n- after L1: new guard\n- before L1: old bug')
  })

  it('prints the stat caption and spark series, but not the hint tone', () => {
    const md = blockMd({
      type: 'stat', caption: 'Flash sale',
      items: [{ label: 'Peak RPS', value: '4,800', hint: 'up', hintTone: 'teal', spark: [6, 9, 20] }],
    })
    expect(md).toContain('**Flash sale**\n\n- **Peak RPS**: 4,800 (up); trend: 6, 9, 20')
    expect(md).not.toContain('teal')
  })

  it('writes table align as a GFM alignment row and leaves cell tones out', () => {
    const md = blockMd({
      type: 'table', head: ['option', 'latency', 'note'], rows: [['KV', '5 ms', 'x']],
      align: ['left', 'right'], cells: [{ row: 1, col: 2, tone: 'warn' }],
    })
    expect(md).toContain('| option | latency | note |\n| :--- | ---: | --- |')
    expect(md).not.toContain('warn')
  })

  it('adds a numbered step list after a seq diagram when any step has list text', () => {
    const md = blockMd({
      type: 'seq', actors: ['web', 'api'],
      steps: [{ from: 'web', to: 'api', label: 'GET /orders', text: 'Client sends GET /orders' }, { from: 'api', to: 'web', label: '200' }],
    })
    expect(md).toContain('web->>api: GET /orders')
    expect(md).toContain('```\n\nSteps:\n1. Client sends GET /orders\n2. 200')
    expect(blockMd({ type: 'seq', actors: ['web', 'api'], steps: [{ from: 'web', to: 'api', label: 'GET' }] })).not.toContain('Steps:')
  })

  it('names the histogram threshold and the first bin past it', () => {
    const bins = [{ label: '1', count: 4 }, { label: '2', count: 2 }, { label: '3 s', count: 1 }]
    expect(blockMd({ type: 'histogram', bins, threshold: { bin: 3, label: 'p95', value: '2.4 s' } }))
      .toContain('| 3 s | 1 |\n\nThreshold: p95 2.4 s (bins from "3 s" on are past it)')
    expect(blockMd({ type: 'histogram', bins, threshold: { bin: 9, label: 'SLO' } })).toMatch(/Threshold: SLO\n?$/)
  })

  it('leaves state and transition tones and the layers diff link out of the mermaid', () => {
    const state = blockMd({
      type: 'state', initial: 'a',
      states: [{ id: 'a', label: 'A', tone: 'good' }, { id: 'b', label: 'B', tone: 'bad' }],
      transitions: [{ from: 'a', to: 'b', label: 'fail', tone: 'bad' }],
    })
    expect(state).toContain('  a: A\n  b: B\n  a --> b: fail\n```')
    const layers = blockMd({ type: 'layers', layers: [{ id: 'l', label: 'L', nodes: [{ id: 'n', label: 'N', diffNode: 'limiter' }], edges: [] }] })
    expect(layers).toContain('    n["N"]\n  end')
    expect(layers).not.toContain('limiter')
  })

  it('collapses newlines in new single-line texts', () => {
    expect(blockMd({ type: 'code', language: 'ts', code: 'a', notes: [{ from: 1, text: 'x\n## injected' }] })).toContain('- L1: x ## injected')
    const glossary = payloadToMarkdown(withDecisions(undefined, [{ term: 't', def: 'a\n## injected' }]), url)
    expect(glossary).toContain('- **t**: a ## injected')
  })

  it('prints a placeholder line for a stored block the schema cannot read', () => {
    const stored = parseStoredPayload({
      meta: { title: 'R1' },
      sections: [{ id: 's1', no: 1, title: 'S', blocks: [{ type: 'hologram' }, { type: 'p', text: 'kept' }] }],
      decisions: [],
    })
    const md = payloadToMarkdown(stored, url)
    expect(md).toContain('## 1. S\n\n[Block not shown: this version of Brief cannot read a "hologram" block.]\n\nkept')
  })
})
