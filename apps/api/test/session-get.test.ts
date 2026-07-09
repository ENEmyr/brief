import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:test'
import { createApp } from '../src/app'
import type { AppEnv } from '../src/env'

const appEnv = env as unknown as AppEnv
const app = () => createApp(appEnv)

async function createOne(): Promise<string> {
  const res = await app().handle(
    new Request('http://localhost/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        payload: {
          meta: { title: 'T' },
          sections: [{ id: 's', no: 1, title: 'S', blocks: [{ type: 'p', text: 'x' }] }],
          decisions: [],
        },
      }),
    }),
  )
  return ((await res.json()) as { id: string }).id
}

describe('GET /api/session/:id', () => {
  it('returns the session and bumps the expiry window', async () => {
    const id = await createOne()
    const oldTime = Date.now() - 1000
    const futureExpiry = Date.now() + 7 * 86400000
    await appEnv.DB.prepare('UPDATE sessions SET last_opened_at = ?, expires_at = ? WHERE id = ?')
      .bind(oldTime, futureExpiry, id).run()
    const res = await app().handle(new Request(`http://localhost/api/session/${id}`))
    expect(res.status).toBe(200)
    const json = (await res.json()) as { payload: string; encrypted: boolean; expiresAt: number }
    expect(JSON.parse(json.payload).meta.title).toBe('T')
    expect(json.encrypted).toBe(false)
    expect(json.expiresAt).toBeGreaterThan(Date.now())
  })

  it('404s unknown ids', async () => {
    const res = await app().handle(new Request('http://localhost/api/session/nope-nope-nope'))
    expect(res.status).toBe(404)
  })

  it('404s and deletes expired sessions', async () => {
    const id = await createOne()
    await appEnv.DB.prepare('UPDATE sessions SET expires_at = 1 WHERE id = ?').bind(id).run()
    const res = await app().handle(new Request(`http://localhost/api/session/${id}`))
    expect(res.status).toBe(404)
    const row = await appEnv.DB.prepare('SELECT id FROM sessions WHERE id = ?').bind(id).first()
    expect(row).toBeNull()
  })

  it('caches the row in KV', async () => {
    const id = await createOne()
    await app().handle(new Request(`http://localhost/api/session/${id}`))
    const cached = await appEnv.KV.get(`payload:${id}`)
    expect(cached).not.toBeNull()
  })
})
