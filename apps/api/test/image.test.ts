import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:test'
import { createApp } from '../src/app'
import { purgeExpired } from '../src/features/purge'
import type { AppEnv } from '../src/env'

const appEnv = env as unknown as AppEnv
const app = (overrides: Partial<AppEnv> = {}) => createApp({ ...appEnv, ...overrides })

const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
)
const bytesOf = (text: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(text)
const concat = (...parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.byteLength
  }
  return out
}

const upload = (body: Uint8Array<ArrayBuffer>, contentType = 'image/png', overrides: Partial<AppEnv> = {}) =>
  app(overrides).handle(
    new Request('http://localhost/api/image', { method: 'POST', headers: { 'content-type': contentType }, body }),
  )

const uploadEncrypted = (sessionId: string, body: Uint8Array<ArrayBuffer>) =>
  app().handle(
    new Request(`http://localhost/api/session/${sessionId}/image`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body,
    }),
  )

const serve = (imageId: string, origin?: string) =>
  app().handle(new Request(`http://localhost/api/image/${imageId}`, { headers: origin ? { origin } : {} }))

async function uploadId(body: Uint8Array<ArrayBuffer> = PNG): Promise<string> {
  const res = await upload(body)
  expect(res.status).toBe(201)
  return ((await res.json()) as { imageId: string }).imageId
}

async function createSession(imageIds: string[], nestedIds: string[] = []): Promise<string> {
  const blocks: unknown[] = [{ type: 'p', text: 'x' }, ...imageIds.map((imageId) => ({ type: 'image', imageId, alt: 'a' }))]
  if (nestedIds.length > 0) {
    blocks.push({ type: 'details', summary: 'd', blocks: nestedIds.map((imageId) => ({ type: 'image', imageId, alt: 'a' })) })
  }
  const res = await app().handle(
    new Request('http://localhost/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: { meta: { title: 'T' }, sections: [{ id: 's', no: 1, title: 'S', blocks }], decisions: [] } }),
    }),
  )
  expect(res.status).toBe(201)
  return ((await res.json()) as { id: string }).id
}

const imageRow = (id: string) =>
  appEnv.DB.prepare('SELECT session_id, content_type, encrypted, byte_size FROM images WHERE id = ?').bind(id).first()

describe('POST /api/image', () => {
  it('stores a PNG as an unlinked image and returns its id', async () => {
    const res = await upload(PNG)
    expect(res.status).toBe(201)
    const json = (await res.json()) as { imageId: string; contentType: string; bytes: number }
    expect(json.imageId).toMatch(/^img_[0-9a-zA-Z]{16}$/)
    expect(json.contentType).toBe('image/png')
    expect(json.bytes).toBe(PNG.byteLength)
    expect(await imageRow(json.imageId)).toEqual({ session_id: null, content_type: 'image/png', encrypted: 0, byte_size: PNG.byteLength })
    const object = await appEnv.IMAGES.get(`images/${json.imageId}`)
    expect(new Uint8Array(await object!.arrayBuffer())).toEqual(PNG)
  })

  it.each([
    ['image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])],
    ['image/gif', bytesOf('GIF89a\x01\x00\x01\x00')],
    ['image/gif', bytesOf('GIF87a\x01\x00\x01\x00')],
    ['image/webp', bytesOf('RIFF\x24\x00\x00\x00WEBPVP8 ')],
  ])('sniffs %s from magic bytes, whatever the declared type', async (expected, body) => {
    const res = await upload(body, 'text/plain')
    expect(res.status).toBe(201)
    expect(((await res.json()) as { contentType: string }).contentType).toBe(expected)
  })

  it.each([
    ['an SVG', bytesOf('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'image/svg+xml'],
    ['a text file renamed to .png', bytesOf('not really a png at all'), 'image/png'],
    ['a RIFF file that is not WebP', bytesOf('RIFF\x24\x00\x00\x00WAVEfmt '), 'image/webp'],
  ])('rejects %s with a fixed 415 message', async (_name, body, contentType) => {
    const res = await upload(body, contentType)
    expect(res.status).toBe(415)
    expect(await res.json()).toEqual({ error: 'Unsupported image type. Upload PNG, JPEG, WebP or GIF.' })
  })

  it('rejects a body over the 5 MiB cap with a fixed 413 message and stores nothing', async () => {
    const before = await appEnv.DB.prepare('SELECT COUNT(*) AS n FROM images').first<{ n: number }>()
    const res = await upload(concat(PNG, new Uint8Array(5 * 1024 * 1024)))
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ error: 'Image exceeds 5242880 bytes.' })
    const after = await appEnv.DB.prepare('SELECT COUNT(*) AS n FROM images').first<{ n: number }>()
    expect(after?.n).toBe(before?.n)
  })

  it('rejects an empty body with a fixed 400 message', async () => {
    const res = await upload(new Uint8Array(0))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Image body is empty.' })
  })

  it('answers 429 with a fixed message once the per-IP limiter refuses, keyed by IP', async () => {
    const keys: string[] = []
    const limiter = { limit: async ({ key }: { key: string }) => (keys.push(key), { success: false }) }
    const res = await app({ RATE_LIMITER: limiter }).handle(
      new Request('http://localhost/api/image', {
        method: 'POST',
        headers: { 'content-type': 'image/png', 'cf-connecting-ip': '203.0.113.7' },
        body: PNG,
      }),
    )
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'Rate limit exceeded. Try again in a minute.' })
    expect(keys).toEqual(['image:203.0.113.7'])
  })
})

describe('linking at POST /api/session', () => {
  it('links top-level and details-nested image blocks to the new session', async () => {
    const top = await uploadId()
    const nested = await uploadId()
    const sessionId = await createSession([top], [nested])
    expect((await imageRow(top))?.session_id).toBe(sessionId)
    expect((await imageRow(nested))?.session_id).toBe(sessionId)
  })

  it('still creates the session when an id is unknown, and does not relink an image owned by another session', async () => {
    const owned = await uploadId()
    const first = await createSession([owned])
    const second = await createSession([owned, 'img_unknown00000000'])
    expect(second).not.toBe(first)
    expect((await imageRow(owned))?.session_id).toBe(first)
  })

  it('does not link an orphan older than the one hour window', async () => {
    const stale = await uploadId()
    await appEnv.DB.prepare('UPDATE images SET created_at = ? WHERE id = ?').bind(Date.now() - 61 * 60 * 1000, stale).run()
    await createSession([stale])
    expect((await imageRow(stale))?.session_id).toBeNull()
  })
})

describe('GET /api/image/:imageId', () => {
  it('serves a linked image byte for byte with its type, nosniff, CSP, CORS and a cache that ends at expiry', async () => {
    const imageId = await uploadId()
    const sessionId = await createSession([imageId])
    const expiresAt = (await appEnv.DB.prepare('SELECT expires_at FROM sessions WHERE id = ?').bind(sessionId).first<{ expires_at: number }>())!.expires_at
    const res = await serve(imageId, 'http://localhost:3000')
    expect(res.status).toBe(200)
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox")
    expect(res.headers.get('content-disposition')).toBe('inline')
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
    const maxAge = Number(/^private, max-age=(\d+)$/.exec(res.headers.get('cache-control') ?? '')?.[1])
    expect(maxAge).toBeLessThanOrEqual(Math.ceil((expiresAt - Date.now()) / 1000))
    expect(maxAge).toBeGreaterThan(7 * 86400 - 60)
  })

  it('404s an unlinked upload, an unknown id and an id outside the pattern with a fixed message', async () => {
    const unlinked = await uploadId()
    for (const id of [unlinked, 'img_unknown00000000', 'bad.id', '..%2F..%2Fsecret']) {
      const res = await serve(id)
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Image not found or expired.' })
    }
  })

  it('404s once the session has expired or its row is gone', async () => {
    const expiredImage = await uploadId()
    const expiredSession = await createSession([expiredImage])
    await appEnv.DB.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').bind(Date.now() - 1, expiredSession).run()
    expect((await serve(expiredImage)).status).toBe(404)

    const goneImage = await uploadId()
    const goneSession = await createSession([goneImage])
    await appEnv.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(goneSession).run()
    expect((await serve(goneImage)).status).toBe(404)
  })
})

describe('POST /api/session/:id/image (encrypted)', () => {
  it('round-trips client ciphertext byte for byte as application/octet-stream', async () => {
    const sessionId = await createSession([])
    const ciphertext = new Uint8Array(4096)
    crypto.getRandomValues(ciphertext)
    ciphertext.set([0x3c, 0x73, 0x76, 0x67], 0)
    const res = await uploadEncrypted(sessionId, ciphertext)
    expect(res.status).toBe(201)
    const json = (await res.json()) as { imageId: string; contentType: string; bytes: number }
    expect(json.contentType).toBe('application/octet-stream')
    expect(json.bytes).toBe(4096)
    expect(await imageRow(json.imageId)).toEqual({
      session_id: sessionId,
      content_type: 'application/octet-stream',
      encrypted: 1,
      byte_size: 4096,
    })
    const served = await serve(json.imageId)
    expect(served.status).toBe(200)
    expect(served.headers.get('content-type')).toBe('application/octet-stream')
    expect(served.headers.get('content-disposition')).toBe('attachment')
    expect(served.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(ciphertext)
  })

  it('404s an unknown session and 409s an encrypted one with fixed messages', async () => {
    const missing = await uploadEncrypted('absent-absent-x', Uint8Array.from([1, 2, 3]))
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'Session not found or expired.' })

    const sessionId = await createSession([])
    await appEnv.DB.prepare('UPDATE sessions SET encrypted = 1 WHERE id = ?').bind(sessionId).run()
    const encrypted = await uploadEncrypted(sessionId, Uint8Array.from([1, 2, 3]))
    expect(encrypted.status).toBe(409)
    expect(await encrypted.json()).toEqual({ error: 'Session is already encrypted.' })
  })

  it('another session payload never relinks an encrypted upload', async () => {
    const sessionId = await createSession([])
    const res = await uploadEncrypted(sessionId, Uint8Array.from([9, 9, 9]))
    const { imageId } = (await res.json()) as { imageId: string }
    const other = await createSession([imageId])
    expect(other).not.toBe(sessionId)
    expect((await imageRow(imageId))?.session_id).toBe(sessionId)
  })
})

describe('purgeExpired with images', () => {
  it('deletes R2 objects and rows of expired, vanished and orphaned images, and keeps live ones', async () => {
    const now = Date.now()
    const live = await uploadId()
    await createSession([live])
    const expired = await uploadId()
    const expiredSession = await createSession([expired])
    await appEnv.DB.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').bind(now - 1, expiredSession).run()
    const vanished = await uploadId()
    const vanishedSession = await createSession([vanished])
    await appEnv.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(vanishedSession).run()
    const freshOrphan = await uploadId()
    const staleOrphan = await uploadId()
    await appEnv.DB.prepare('UPDATE images SET created_at = ? WHERE id = ?').bind(now - 61 * 60 * 1000, staleOrphan).run()

    await purgeExpired(appEnv, now)

    for (const gone of [expired, vanished, staleOrphan]) {
      expect(await appEnv.IMAGES.head(`images/${gone}`)).toBeNull()
      expect(await imageRow(gone)).toBeNull()
    }
    for (const kept of [live, freshOrphan]) {
      expect(await appEnv.IMAGES.head(`images/${kept}`)).not.toBeNull()
      expect(await imageRow(kept)).not.toBeNull()
    }
    expect(await appEnv.DB.prepare('SELECT id FROM sessions WHERE id = ?').bind(expiredSession).first()).toBeNull()
  })

  it('pages through more images than one D1 statement can bind', async () => {
    const now = Date.now()
    const ids: string[] = []
    for (let i = 0; i < 120; i++) ids.push(await uploadId())
    await appEnv.DB.prepare('UPDATE images SET created_at = ?').bind(now - 61 * 60 * 1000).run()
    await purgeExpired(appEnv, now)
    expect(await appEnv.DB.prepare('SELECT COUNT(*) AS n FROM images').first<{ n: number }>()).toEqual({ n: 0 })
    const listed = await appEnv.IMAGES.list({ prefix: 'images/' })
    expect(listed.objects).toEqual([])
  })
})
