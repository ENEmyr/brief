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

const put = (id: string, body: unknown) =>
  app().handle(
    new Request(`http://localhost/api/session/${id}/save`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )

describe('PUT /api/session/:id/save', () => {
  it('plain save extends expiry to the 90 day window', async () => {
    const id = await createOne()
    const res = await put(id, { mode: 'plain' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { saved: boolean; encrypted: boolean; expiresAt: number }
    expect(json.saved).toBe(true)
    expect(json.encrypted).toBe(false)
    expect(json.expiresAt - Date.now()).toBeGreaterThan(89 * 86400000)
  })

  it('encrypt save overwrites payload, stores params, purges kv cache', async () => {
    const id = await createOne()
    await app().handle(new Request(`http://localhost/api/session/${id}`)) // populate cache
    const res = await put(id, {
      mode: 'encrypt',
      ciphertext: 'c2VjcmV0',
      encParams: { salt: 'AAAA', iv: 'BBBB', iterations: 600000 },
    })
    expect(res.status).toBe(200)
    const row = await appEnv.DB.prepare('SELECT payload, encrypted, enc_params FROM sessions WHERE id = ?')
      .bind(id).first()
    expect(row?.payload).toBe('c2VjcmV0')
    expect(row?.encrypted).toBe(1)
    expect(await appEnv.KV.get(`payload:${id}`)).toBeNull()
  })

  it('409s a second encryption', async () => {
    const id = await createOne()
    await put(id, { mode: 'encrypt', ciphertext: 'YQ==', encParams: { salt: 'A', iv: 'B', iterations: 600000 } })
    const res = await put(id, { mode: 'encrypt', ciphertext: 'Yg==', encParams: { salt: 'A', iv: 'B', iterations: 600000 } })
    expect(res.status).toBe(409)
  })

  it('404s unknown sessions', async () => {
    const res = await put('absent-absent-x', { mode: 'plain' })
    expect(res.status).toBe(404)
  })
})
