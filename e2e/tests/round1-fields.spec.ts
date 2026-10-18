import type { Payload } from '@brief/schema'
import { test, expect, API_URL } from './fixtures'

const payload: Payload = {
  meta: { title: 'Round 1 fields' },
  sections: [
    {
      id: 'bucket',
      no: 2,
      title: 'Token bucket',
      blocks: [
        { type: 'list', ordered: true, items: ['Take a token', 'Forward the request'] },
        { type: 'stat', caption: 'Flash sale', items: [{ label: 'Peak RPS', value: '4,800', hintTone: 'red', spark: [6, 9, 20] }] },
        { type: 'table', head: ['option', 'latency'], rows: [['KV', '5 ms']], align: ['left', 'right'], cells: [{ row: 1, col: 2, tone: 'warn' }] },
        { type: 'seq', actors: ['web', 'api'], steps: [{ from: 'web', to: 'api', label: 'GET', text: 'Client sends GET /orders' }] },
        { type: 'histogram', bins: [{ label: '1', count: 3 }, { label: '2 s', count: 1 }], threshold: { bin: 2, label: 'p95', value: '2.4 s' } },
        { type: 'state', initial: 'a', states: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', tone: 'bad' }], transitions: [{ from: 'a', to: 'b', tone: 'bad' }] },
        { type: 'layers', layers: [{ id: 'edge', label: 'Edge', nodes: [{ id: 'limiter', label: 'Limiter', diffNode: 'limiter' }], edges: [] }] },
        { type: 'code', language: 'ts', code: 'take(key, 1)', notes: [{ from: 1, text: 'One token per request' }] },
        { type: 'ba', language: 'ts', before: 'a', after: 'b', filename: 'src/limiter.ts', notes: [{ side: 'after', from: 1, text: 'New guard' }] },
      ],
    },
  ],
  decisions: [{ id: 'D1', q: 'Which limiter?', multi: false, opts: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], refs: ['bucket'] }],
  glossary: [{ term: 'token bucket', def: 'A counter that refills at a fixed rate.', aliases: ['bucket'] }],
}

test.describe('round 1 payload fields through the API', () => {
  test('the API stores every field and /raw prints it', async ({ request, createSession, isMobile }) => {
    test.skip(isMobile, 'API-only check; the browser project does not change it')
    const { id } = await createSession(payload)

    const session = await request.get(`${API_URL}/api/session/${id}`)
    expect(session.ok()).toBe(true)
    const stored = JSON.parse(((await session.json()) as { payload: string }).payload) as Payload
    expect(stored).toEqual(payload)

    const raw = await request.get(`${API_URL}/api/session/${id}/raw`)
    expect(raw.status()).toBe(200)
    const md = await raw.text()
    for (const line of [
      '1. Take a token',
      '**Flash sale**',
      '- **Peak RPS**: 4,800; trend: 6, 9, 20',
      '| :--- | ---: |',
      'Steps:\n1. Client sends GET /orders',
      'Threshold: p95 2.4 s (bins from "2 s" on are past it)',
      'Agent notes:\n- L1: One token per request',
      '`src/limiter.ts`',
      '- after L1: New guard',
      'Context: 02 Token bucket',
      '## Glossary\n\n- **token bucket** (also: bucket): A counter that refills at a fixed rate.',
    ]) {
      expect(md).toContain(line)
    }
  })
})
