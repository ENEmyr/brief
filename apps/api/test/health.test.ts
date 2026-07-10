import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:test'
import { createApp } from '../src/app'
import type { AppEnv } from '../src/env'

describe('health', () => {
  it('responds ok', async () => {
    const app = createApp(env as unknown as AppEnv)
    // Elysia's router locates the path with url.indexOf('/', 11), so the origin
    // must be long enough for the first path slash to sit at index >= 11.
    // A short host like http://x makes every route 404.
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})

describe('unknown route', () => {
  it('returns a JSON 404 instead of the Elysia default text body', async () => {
    const app = createApp(env as unknown as AppEnv)
    const res = await app.handle(new Request('http://localhost/nope'))
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual({ error: 'Not found.' })
  })
})
