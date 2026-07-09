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
