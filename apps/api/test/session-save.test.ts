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

  it('encrypt save blanks the plaintext title in D1 and the GET response (zero-knowledge)', async () => {
    const id = await createOne()
    const res = await put(id, {
      mode: 'encrypt',
      ciphertext: 'c2VjcmV0',
      encParams: { salt: 'AAAA', iv: 'BBBB', iterations: 600000 },
    })
    expect(res.status).toBe(200)
    const row = await appEnv.DB.prepare('SELECT title FROM sessions WHERE id = ?').bind(id).first()
    expect(row?.title).toBe('')
    const getRes = await app().handle(new Request(`http://localhost/api/session/${id}`))
    const json = (await getRes.json()) as { title: string }
    expect(json.title).toBe('')
  })

  it('encrypt save purges pre-encryption reader state so plaintext excerpts do not outlive it', async () => {
    const id = await createOne()
    // Seed reader state the way the client's state-sync does before the doc is protected —
    // this blob can contain plaintext highlight/note excerpts from the doc.
    const statePutRes = await app().handle(
      new Request(`http://localhost/api/session/${id}/state`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: '{"highlights":["plaintext excerpt"]}' }),
      }),
    )
    expect(statePutRes.status).toBe(204)
    expect(await appEnv.KV.get(`state:${id}`)).not.toBeNull()

    const res = await put(id, {
      mode: 'encrypt',
      ciphertext: 'c2VjcmV0',
      encParams: { salt: 'AAAA', iv: 'BBBB', iterations: 600000 },
    })
    expect(res.status).toBe(200)

    expect(await appEnv.KV.get(`state:${id}`)).toBeNull()
    const stateGetRes = await app().handle(new Request(`http://localhost/api/session/${id}/state`))
    expect(((await stateGetRes.json()) as { state: null }).state).toBeNull()
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

  it('plain save after encrypt does not clobber ciphertext, encParams, or the encrypted flag', async () => {
    const id = await createOne()
    const encryptRes = await put(id, {
      mode: 'encrypt',
      ciphertext: 'c2VjcmV0',
      encParams: { salt: 'AAAA', iv: 'BBBB', iterations: 600000 },
    })
    expect(encryptRes.status).toBe(200)

    const res = await put(id, { mode: 'plain' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { encrypted: boolean }
    expect(json.encrypted).toBe(true)

    const row = await appEnv.DB.prepare('SELECT payload, encrypted, enc_params FROM sessions WHERE id = ?')
      .bind(id).first()
    expect(row?.payload).toBe('c2VjcmV0')
    expect(row?.encrypted).toBe(1)
    expect(row?.enc_params).toBe(JSON.stringify({ salt: 'AAAA', iv: 'BBBB', iterations: 600000 }))
  })

  it('rejects an oversize ciphertext with 413', async () => {
    const id = await createOne()
    const res = await put(id, {
      mode: 'encrypt',
      ciphertext: 'A'.repeat(2_000_000),
      encParams: { salt: 'AAAA', iv: 'BBBB', iterations: 600000 },
    })
    expect(res.status).toBe(413)
  })

  it('rejects a multi-byte ciphertext over the byte cap with 413 even when char count passes zod', async () => {
    const id = await createOne()
    // 700k chars (under the 1,950,000 char zod cap) but 2.1MB UTF-8 (over the byte cap):
    // must fall through zod and hit the saveSession byte-length gate.
    const res = await put(id, {
      mode: 'encrypt',
      ciphertext: 'ก'.repeat(700_000),
      encParams: { salt: 'AAAA', iv: 'BBBB', iterations: 600000 },
    })
    expect(res.status).toBe(413)
  })

  it('cache-hit GET after a concurrent save does not shrink the 90 day expiry', async () => {
    const id = await createOne()
    // GET populates KV with a saved:false row (7d window).
    await app().handle(new Request(`http://localhost/api/session/${id}`))
    // Simulate a concurrent PUT /save landing in D1 while KV still holds the stale row.
    const savedExpiry = Date.now() + 90 * 86400000
    await appEnv.DB.prepare('UPDATE sessions SET saved = 1, expires_at = ? WHERE id = ?')
      .bind(savedExpiry, id).run()
    // Second GET is a KV cache hit with stale saved:false; the bump must not shrink D1.
    const res = await app().handle(new Request(`http://localhost/api/session/${id}`))
    expect(res.status).toBe(200)
    const json = (await res.json()) as { expiresAt: number }
    expect(json.expiresAt).toBeGreaterThanOrEqual(savedExpiry)
    const row = await appEnv.DB.prepare('SELECT expires_at FROM sessions WHERE id = ?').bind(id).first()
    expect(row?.expires_at as number).toBeGreaterThanOrEqual(savedExpiry)
  })
})
