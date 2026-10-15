import type { Page } from '@playwright/test'
import type { Payload } from '@brief/schema'
import { test, expect, API_URL } from './fixtures'

// 64 x 32 solid PNG, so a decoded image has a measurable natural size.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAIAAAAt/+nTAAAAN0lEQVR42u3PQQkAAAgEsOtlO0P7NoNPYbACS/W8FgEBAQEBAQEBAQEBAQEBAQEBAQEBAQGBqwVb85jELwJVygAAAABJRU5ErkJggg==',
  'base64',
)
const ALT = 'p95 latency per day, before and after the limiter'
const CAPTION = 'Figure 1. Latency after the limiter'

const withImage = (imageId: string, title = 'Image UI'): Payload => ({
  meta: { title },
  sections: [
    {
      id: 's',
      no: 1,
      title: 'Latency',
      blocks: [{ type: 'image', imageId, alt: ALT, caption: CAPTION, width: 640, height: 320 }],
    },
  ],
  decisions: [],
})

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

async function sessionKey(password: string, salt: Uint8Array, iterations: number) {
  const subtle = globalThis.crypto.subtle
  const base = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  )
}

async function seal(key: CryptoKey, bytes: Uint8Array) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes))
  return { iv, ciphertext }
}

async function decodedImage(page: Page) {
  const img = page.getByRole('img', { name: ALT })
  await expect(img).toBeVisible()
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(64)
  return img
}

test.describe('image block in the reader', () => {
  test('a plain brief shows the image in its card with alt and caption, box reserved before load', async ({
    page,
    request,
    createSession,
  }) => {
    const upload = await request.post(`${API_URL}/api/image`, { headers: { 'content-type': 'image/png' }, data: PNG })
    expect(upload.status()).toBe(201)
    const { imageId } = (await upload.json()) as { imageId: string }
    const { id } = await createSession(withImage(imageId))

    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    await page.route(`${API_URL}/api/image/${imageId}`, async (route) => {
      await held
      await route.continue()
    })
    await page.goto(`/s/${id}`)

    const box = page.locator('[data-image-body] > div')
    const card = page.locator('figure', { has: box })
    await expect(page.locator('[data-image-loading]')).toBeVisible()
    const before = await box.boundingBox()
    const cardBefore = await card.boundingBox()
    expect(before).not.toBeNull()
    expect(Math.round(before!.height * 2)).toBe(Math.round(before!.width))

    release()
    const img = await decodedImage(page)
    expect(await box.boundingBox()).toEqual(before)
    expect(await card.boundingBox()).toEqual(cardBefore)
    expect(await img.getAttribute('src')).toMatch(/^blob:/)
    await expect(page.locator('figure', { has: img }).getByText(CAPTION)).toBeVisible()
  })

  test('a missing image shows the fixed message in the card and no image element', async ({ page, createSession }) => {
    const { id } = await createSession(withImage('img_neveruploaded0001'))
    await page.goto(`/s/${id}`)

    const card = page.locator('figure', { has: page.locator('[data-kind-tag]', { hasText: 'image' }) })
    await expect(card.getByRole('alert')).toHaveText('Image is missing or has expired.')
    await expect(card.locator('img')).toHaveCount(0)
    await expect(card.getByText(CAPTION)).toBeVisible()
  })

  test('an encrypted brief decrypts its image in the browser after unlock', async ({ page, request, createSession }) => {
    const password = 'image-block-passphrase'
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16))
    const iterations = 600_000
    const key = await sessionKey(password, salt, iterations)

    const { id } = await createSession(withImage('img_placeholder00001', 'Before encrypt'))
    const sealed = await seal(key, PNG)
    const blob = Buffer.concat([Buffer.from(sealed.iv), Buffer.from(sealed.ciphertext)])
    const upload = await request.post(`${API_URL}/api/session/${id}/image`, {
      headers: { 'content-type': 'application/octet-stream' },
      data: blob,
    })
    expect(upload.status()).toBe(201)
    const { imageId } = (await upload.json()) as { imageId: string }

    const payload = await seal(key, new TextEncoder().encode(JSON.stringify(withImage(imageId, 'Encrypted image'))))
    const save = await request.put(`${API_URL}/api/session/${id}/save`, {
      data: {
        mode: 'encrypt',
        ciphertext: b64(payload.ciphertext),
        encParams: { salt: b64(salt), iv: b64(payload.iv), iterations },
      },
    })
    expect(save.ok()).toBe(true)

    const served = await request.get(`${API_URL}/api/image/${imageId}`)
    expect(served.headers()['content-type']).toBe('application/octet-stream')

    await page.goto(`/s/${id}`)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Unlock' }).click()
    const img = await decodedImage(page)
    expect(await img.getAttribute('src')).toMatch(/^blob:/)
  })

  test('the image prints with its caption below it, and the caption copies as plain text', async ({
    page,
    request,
    createSession,
    isMobile,
  }) => {
    test.skip(isMobile, 'print media and the mouse selection are desktop paths')
    const upload = await request.post(`${API_URL}/api/image`, { headers: { 'content-type': 'image/png' }, data: PNG })
    const { imageId } = (await upload.json()) as { imageId: string }
    const { id } = await createSession(withImage(imageId))
    await page.goto(`/s/${id}`)
    const img = await decodedImage(page)

    await page.emulateMedia({ media: 'print' })
    const figure = page.locator('figure', { has: img })
    const caption = figure.locator('> div:first-child')
    const [imgBox, captionBox] = [await img.boundingBox(), await caption.boundingBox()]
    expect(captionBox!.y).toBeGreaterThanOrEqual(imgBox!.y + imgBox!.height)
    expect(await caption.evaluate((el) => getComputedStyle(el).fontSize)).toBe('12px')
    await expect(figure.locator('[data-kind-tag]')).toBeHidden()
    await page.emulateMedia({ media: 'screen' })

    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const copied = await figure.getByText(CAPTION).evaluate(async (el) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)
      document.execCommand('copy')
      return navigator.clipboard.readText()
    })
    expect(copied).toBe(CAPTION)
  })
})
