import type { Payload } from '@brief/schema'
import { test, expect, API_URL } from './fixtures'

const XSS = '<img src=x onerror=alert(1)>'

const payload: Payload = {
  meta: { title: 'Round 2 blocks' },
  sections: [
    {
      id: 'limiter',
      no: 1,
      title: 'Rate limiter',
      blocks: [
        {
          type: 'walkthrough', language: 'ts', filename: 'src/limiter.ts', title: 'handle()',
          code: 'const key = resolveKey(req)\nif (!ok) return tooMany(30)',
          flow: { nodes: [{ id: 'req', label: 'Request', kind: 'start' }, { id: 'deny', label: 'Reply 429', kind: 'end' }], edges: [{ from: 'req', to: 'deny', label: 'empty' }] },
          steps: [{ from: 1, title: 'Find the key', nodes: ['req'] }, { from: 2, title: XSS, nodes: ['deny'] }],
        },
        {
          type: 'diff',
          files: [{
            path: 'src/limiter.ts', status: 'modified', patch: '@@ -1 +1 @@\n-return fetch(req.url)\n+return fetch(origin(req))',
            changes: [{ symbol: 'handle()', change: 'modified', summary: 'Checks the limiter before forwarding.', steps: ['take a token'] }],
          }],
          map: { nodes: [{ id: 'limiter', label: 'limiter.ts', status: 'modified' }], edges: [] },
        },
        {
          type: 'trajectory', stats: { seconds: 252, tokens: 38_200 },
          steps: [
            { at: '2026-10-15T01:00:00Z', kind: 'request', title: 'Do not touch webhook endpoints' },
            { at: '2026-10-15T01:00:52.250Z', kind: 'assumption', title: 'Webhooks come from fixed IPs', detail: XSS, flag: true },
          ],
        },
        { type: 'image', imageId: 'img_4f9Kq2xZ7bN1', alt: 'p95 latency per day', caption: 'Figure 1', width: 1200, height: 640 },
      ],
    },
  ],
  decisions: [],
}

test.describe('round 2 block types through the API', () => {
  test('the API stores every block and /raw prints it as text', async ({ request, createSession, isMobile }) => {
    test.skip(isMobile, 'API-only check; the browser project does not change it')
    const { id } = await createSession(payload)

    const session = await request.get(`${API_URL}/api/session/${id}`)
    expect(session.ok()).toBe(true)
    const stored = JSON.parse(((await session.json()) as { payload: string }).payload) as Payload
    expect(stored).toEqual(payload)

    const raw = await request.get(`${API_URL}/api/session/${id}/raw`)
    expect(raw.status()).toBe(200)
    expect(raw.headers()['content-type']).toBe('text/markdown; charset=utf-8')
    const md = await raw.text()
    for (const line of [
      '`src/limiter.ts` / handle()',
      `Walkthrough:\n1. L1: Find the key (flow: req)\n2. L2: ${XSS} (flow: deny)`,
      '  req(["Request"])\n  deny(["Reply 429"])\n  req --> |empty|deny',
      '**modified** `src/limiter.ts`\n\n- modified `handle()`: Checks the limiter before forwarding. Steps: take a token.',
      '```diff\n@@ -1 +1 @@\n-return fetch(req.url)\n+return fetch(origin(req))\n```',
      'Change map:',
      'Agent trajectory: 2 steps, 252 s, 38200 tokens',
      `| 2026-10-15T01:00:52.250Z | assumption | Webhooks come from fixed IPs | ${XSS} | ask the reader |`,
      '**Figure 1**\n\n[Image `img_4f9Kq2xZ7bN1`: p95 latency per day]',
    ]) {
      expect(md).toContain(line)
    }
  })

  test('the API rejects an image block that carries a URL instead of an id', async ({ request, isMobile }) => {
    test.skip(isMobile, 'API-only check; the browser project does not change it')
    const bad = structuredClone(payload)
    bad.sections[0]!.blocks = [{ type: 'image', imageId: 'https://evil.test/x.png', alt: 'a' }]
    const res = await request.post(`${API_URL}/api/session`, { data: { payload: bad } })
    expect(res.status()).toBe(400)
  })

  test('the API rejects a trajectory step time with an offset instead of Z', async ({ request, isMobile }) => {
    test.skip(isMobile, 'API-only check; the browser project does not change it')
    const bad = structuredClone(payload)
    bad.sections[0]!.blocks = [{ type: 'trajectory', steps: [{ at: '2026-10-15T08:00:00+07:00', kind: 'note', title: 'n' }] }]
    const res = await request.post(`${API_URL}/api/session`, { data: { payload: bad } })
    expect(res.status()).toBe(400)
  })
})
