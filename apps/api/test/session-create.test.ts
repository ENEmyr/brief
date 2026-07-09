import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:test'
import { createApp } from '../src/app'
import type { AppEnv } from '../src/env'

const appEnv = env as unknown as AppEnv
const validBody = {
  payload: {
    meta: { title: 'T' },
    sections: [{ id: 's', no: 1, title: 'S', blocks: [{ type: 'p', text: 'x' }] }],
    decisions: [],
  },
}

const post = (body: unknown) =>
  createApp(appEnv).handle(
    new Request('http://localhost/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )

describe('POST /api/session', () => {
  it('creates a session and returns id + url', async () => {
    const res = await post(validBody)
    expect(res.status).toBe(201)
    const json = (await res.json()) as { id: string; url: string }
    expect(json.id).toMatch(/^[0-9a-zA-Z]{14}$/)
    expect(json.url).toContain(`/s/${json.id}`)
    const row = await appEnv.DB.prepare(
      'SELECT id, saved, encrypted, enc_params, title, expires_at, last_opened_at FROM sessions WHERE id = ?',
    )
      .bind(json.id).first()
    expect(row?.saved).toBe(0)
    expect(row?.encrypted).toBe(0)
    expect(row?.enc_params).toBeNull()
    expect(row?.title).toBe('T')
    expect(Number(row?.expires_at)).toBe(Number(row?.last_opened_at) + 7 * 24 * 60 * 60 * 1000)
  })

  it('rejects invalid payloads with 400', async () => {
    const res = await post({ payload: { meta: {}, sections: [], decisions: [] } })
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBeTruthy()
  })

  it('rejects oversize payloads with 413', async () => {
    const big = structuredClone(validBody)
    const section = big.payload.sections[0]
    if (section) {
      section.blocks = [{ type: 'p', text: 'a'.repeat(1_900_001) }]
    }
    const res = await post(big)
    expect(res.status).toBe(413)
  })

  it('rejects multibyte payloads with 413 based on byte size, not char length', async () => {
    // 'ก' is a 3-byte UTF-8 Thai character. 700,000 chars = 2.1MB UTF-8, well
    // under the 1.9M UTF-16-code-unit char length but over the byte cap.
    const big = structuredClone(validBody)
    const section = big.payload.sections[0]
    if (section) {
      section.blocks = [{ type: 'p', text: 'ก'.repeat(700_000) }]
    }
    const res = await post(big)
    expect(res.status).toBe(413)
  })
})
