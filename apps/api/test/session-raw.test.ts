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

  it('degrades a stored block type the schema does not know to a placeholder line', async () => {
    const id = await createOne()
    const stored = {
      meta: { title: 'Rolled back' },
      sections: [{
        id: 's', no: 1, title: 'S',
        blocks: [
          { type: 'p', text: 'kept paragraph' },
          { type: 'hologram', frames: 3 },
          { type: 'details', summary: 'More', blocks: [{ type: 'p', text: 'kept inner' }, { type: 'hologram' }] },
        ],
      }],
      decisions: [],
    }
    await appEnv.DB.prepare('UPDATE sessions SET payload = ? WHERE id = ?').bind(JSON.stringify(stored), id).run()
    await appEnv.KV.delete(`payload:${id}`)

    const res = await app().handle(new Request(`http://localhost/api/session/${id}/raw`))
    const md = await res.text()

    expect(res.status).toBe(200)
    expect(md).toContain('kept paragraph')
    expect(md).toContain('kept inner')
    expect(md.split('[Block not shown: this version of Brief cannot read a "hologram" block.]')).toHaveLength(3)
    expect(md).not.toMatch(/\bat \S+:\d+|\/src\/|ZodError/)
  })

  it('404s unknown sessions', async () => {
    const res = await app().handle(new Request('http://localhost/api/session/absent-absent-x/raw'))
    expect(res.status).toBe(404)
  })
})
