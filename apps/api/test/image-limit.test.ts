import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:test'
import { createApp } from '../src/app'
import type { AppEnv } from '../src/env'

const appEnv = env as unknown as AppEnv
const IP = '203.0.113.9'

// The production binding (wrangler.jsonc: simple, 10 per 60 s), counted per key within one window.
function productionLimiter() {
  const hits = new Map<string, number>()
  return {
    keys: () => [...hits.keys()],
    limit: async ({ key }: { key: string }) => {
      const n = (hits.get(key) ?? 0) + 1
      hits.set(key, n)
      return { success: n <= 10 }
    },
  }
}

async function createSession(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await app.handle(
    new Request('http://localhost/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        payload: { meta: { title: 'T' }, sections: [{ id: 's', no: 1, title: 'S', blocks: [{ type: 'p', text: 'x' }] }], decisions: [] },
      }),
    }),
  )
  expect(res.status).toBe(201)
  return ((await res.json()) as { id: string }).id
}

describe('upload limiter on the encrypted image route', () => {
  it('refuses the 11th upload in a window with 429 and an exposed retry-after: 60, keyed by IP', async () => {
    const limiter = productionLimiter()
    const sessionId = await createSession(createApp(appEnv))
    const app = createApp({ ...appEnv, RATE_LIMITER: limiter })
    const statuses: number[] = []
    let last: Response | undefined
    for (let i = 0; i < 11; i++) {
      last = await app.handle(
        new Request(`http://localhost/api/session/${sessionId}/image`, {
          method: 'POST',
          headers: { 'content-type': 'application/octet-stream', 'cf-connecting-ip': IP, origin: 'http://localhost:3000' },
          body: Uint8Array.from([i, 1, 2, 3]),
        }),
      )
      statuses.push(last.status)
    }
    expect(statuses).toEqual([...Array(10).fill(201), 429])
    expect(last!.headers.get('retry-after')).toBe('60')
    // A cross-origin reader only sees retry-after when CORS exposes it.
    expect(last!.headers.get('access-control-expose-headers')).toMatch(/(^|,\s*)retry-after(\s*,|$)/i)
    expect(await last!.json()).toEqual({ error: 'Rate limit exceeded. Try again in a minute.' })
    expect(limiter.keys()).toEqual([`image:${IP}`])
  })
})
