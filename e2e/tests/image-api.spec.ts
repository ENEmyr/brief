import type { Payload } from '@brief/schema'
import { test, expect, API_URL } from './fixtures'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const withImage = (imageId: string): Payload => ({
  meta: { title: 'Image API' },
  sections: [{ id: 's', no: 1, title: 'S', blocks: [{ type: 'image', imageId, alt: 'one pixel' }] }],
  decisions: [],
})

test.describe('image API through the local Worker and R2', () => {
  test('an uploaded PNG links at session create and is served byte for byte', async ({ request, createSession, isMobile }) => {
    test.skip(isMobile, 'API-only check; the browser project does not change it')
    const upload = await request.post(`${API_URL}/api/image`, { headers: { 'content-type': 'image/png' }, data: PNG })
    expect(upload.status()).toBe(201)
    const { imageId, contentType } = (await upload.json()) as { imageId: string; contentType: string }
    expect(contentType).toBe('image/png')

    expect((await request.get(`${API_URL}/api/image/${imageId}`)).status()).toBe(404)
    await createSession(withImage(imageId))

    const served = await request.get(`${API_URL}/api/image/${imageId}`)
    expect(served.status()).toBe(200)
    expect(Buffer.compare(await served.body(), PNG)).toBe(0)
    const headers = served.headers()
    expect(headers['content-type']).toBe('image/png')
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['content-security-policy']).toBe("default-src 'none'; sandbox")
    expect(headers['cache-control']).toBe('no-store')
  })

  test('an SVG upload is refused with a fixed message', async ({ request, isMobile }) => {
    test.skip(isMobile, 'API-only check; the browser project does not change it')
    const res = await request.post(`${API_URL}/api/image`, {
      headers: { 'content-type': 'image/svg+xml' },
      data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    })
    expect(res.status()).toBe(415)
    expect(await res.json()).toEqual({ error: 'Unsupported image type. Upload PNG, JPEG, WebP or GIF.' })
  })

  test('an encrypted upload round-trips as octet-stream', async ({ request, createSession, isMobile }) => {
    test.skip(isMobile, 'API-only check; the browser project does not change it')
    const { id } = await createSession(withImage('img_placeholder000'))
    const ciphertext = Buffer.from(Array.from({ length: 2048 }, (_, i) => (i * 37 + 11) % 256))
    const upload = await request.post(`${API_URL}/api/session/${id}/image`, {
      headers: { 'content-type': 'application/octet-stream' },
      data: ciphertext,
    })
    expect(upload.status()).toBe(201)
    const { imageId } = (await upload.json()) as { imageId: string }
    const served = await request.get(`${API_URL}/api/image/${imageId}`)
    expect(served.status()).toBe(200)
    expect(served.headers()['content-type']).toBe('application/octet-stream')
    expect(Buffer.compare(await served.body(), ciphertext)).toBe(0)
  })
})
