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
          meta: { title: 'Raw me' },
          sections: [{ id: 's', no: 1, title: 'S', blocks: [{ type: 'p', text: 'body text' }] }],
          decisions: [],
        },
      }),
    }),
  )
  return ((await res.json()) as { id: string }).id
}

describe('GET /api/session/:id/raw', () => {
  it('serves self-describing markdown', async () => {
    const id = await createOne()
    const res = await app().handle(new Request(`http://localhost/api/session/${id}/raw`))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/markdown')
    const md = await res.text()
    expect(md).toContain('# Raw me')
    expect(md).toContain('machine-readable source')
  })

  it('403s encrypted sessions', async () => {
    const id = await createOne()
    await appEnv.DB.prepare("UPDATE sessions SET encrypted = 1, payload = 'AAAA', enc_params = '{}' WHERE id = ?")
      .bind(id).run()
    await appEnv.KV.delete(`payload:${id}`)
    const res = await app().handle(new Request(`http://localhost/api/session/${id}/raw`))
    expect(res.status).toBe(403)
  })

  it('404s unknown sessions', async () => {
    const res = await app().handle(new Request('http://localhost/api/session/absent-absent-x/raw'))
    expect(res.status).toBe(404)
  })
})
