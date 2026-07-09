import { describe, it, expect } from 'vitest'
import { payloadToMarkdown, type Payload } from '../src'

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

  it('produces balanced brackets when a layers node label contains a closing bracket', () => {
    const md = payloadToMarkdown(
      {
        meta: { title: 'Layers test' },
        sections: [{
          id: 's1', no: 1, title: 'Layers',
          blocks: [{
            type: 'layers',
            layers: [{
              id: 'l1', label: 'Layer 1',
              nodes: [{ id: 'n1', label: 'Node[1]' }],
              edges: [],
            }],
          }],
        }],
        decisions: [],
      },
      { url: 'https://example.test' },
    )
    expect(md).toContain('Node(1)')
    expect(md).not.toContain('Node[1]')
  })
})
