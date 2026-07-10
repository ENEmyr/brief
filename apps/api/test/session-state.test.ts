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

describe('session state sync', () => {
  it('roundtrips a state blob', async () => {
    const id = await createOne()
    const putRes = await app().handle(
      new Request(`http://localhost/api/session/${id}/state`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: '{"highlights":[1]}' }),
      }),
    )
    expect(putRes.status).toBe(204)
    const getRes = await app().handle(new Request(`http://localhost/api/session/${id}/state`))
    expect(((await getRes.json()) as { state: string }).state).toBe('{"highlights":[1]}')
  })

  it('returns null state when nothing synced', async () => {
    const id = await createOne()
    const res = await app().handle(new Request(`http://localhost/api/session/${id}/state`))
    expect(((await res.json()) as { state: null }).state).toBeNull()
  })

  it('404s PUT for unknown session', async () => {
    const res = await app().handle(
      new Request('http://localhost/api/session/absent-absent-x/state', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: 'x' }),
      }),
    )
    expect(res.status).toBe(404)
  })

  it('403s PUT for an encrypted session (bug-250: state must not resurrect after encrypt purge)', async () => {
    const id = await createOne()
    const encryptRes = await app().handle(
      new Request(`http://localhost/api/session/${id}/save`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'encrypt',
          ciphertext: 'c2VjcmV0',
          encParams: { salt: 'AAAA', iv: 'BBBB', iterations: 600000 },
        }),
      }),
    )
    expect(encryptRes.status).toBe(200)

    const res = await app().handle(
      new Request(`http://localhost/api/session/${id}/state`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: '{"highlights":["plaintext"]}' }),
      }),
    )
    expect(res.status).toBe(403)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Session is protected.')
    expect(await appEnv.KV.get(`state:${id}`)).toBeNull()
  })
})
