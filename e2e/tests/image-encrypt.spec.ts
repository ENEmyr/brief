import type { Page } from '@playwright/test'
import type { Payload } from '@brief/schema'
import { test, expect, API_URL } from './fixtures'

// 64 x 32 solid PNG, so a decoded image has a measurable natural size.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAIAAAAt/+nTAAAAN0lEQVR42u3PQQkAAAgEsOtlO0P7NoNPYbACS/W8FgEBAQEBAQEBAQEBAQEBAQEBAQEBAQGBqwVb85jELwJVygAAAABJRU5ErkJggg==',
  'base64',
)
const TOP_ALT = 'Top level chart'
const NESTED_ALT = 'Chart inside details'
const PASSWORD = 'image-encrypt-passphrase'

const withImages = (topId: string, nestedId: string): Payload => ({
  meta: { title: 'Image encrypt' },
  sections: [
    {
      id: 's',
      no: 1,
      title: 'Charts',
      blocks: [
        { type: 'image', imageId: topId, alt: TOP_ALT, width: 640, height: 320 },
        {
          type: 'details',
          summary: 'More charts',
          blocks: [{ type: 'image', imageId: nestedId, alt: NESTED_ALT, width: 640, height: 320 }],
        },
      ],
    },
  ],
  decisions: [],
})

async function decoded(page: Page, alt: string) {
  const img = page.getByRole('img', { name: alt })
  await expect(img).toBeVisible()
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(64)
}

async function archiveWithPassword(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Archive' }).click()
  } else {
    await page.getByRole('button', { name: 'Archive' }).click()
  }
  const dialog = page.getByRole('dialog', { name: 'Archive this doc' })
  await dialog.getByRole('radio', { name: 'Archive with password' }).click()
  await dialog.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await dialog.getByLabel('Confirm password').fill(PASSWORD)
  await dialog.getByRole('button', { name: 'Archive', exact: true }).click()
  return dialog
}

test.describe('archiving an image brief with a password', () => {
  test('re-encrypts every image, drops the plaintext copies, and shows them again after unlock', async ({
    page,
    request,
    createSession,
    isMobile,
  }) => {
    const plainIds: string[] = []
    for (let i = 0; i < 2; i++) {
      const upload = await request.post(`${API_URL}/api/image`, { headers: { 'content-type': 'image/png' }, data: PNG })
      expect(upload.status()).toBe(201)
      plainIds.push(((await upload.json()) as { imageId: string }).imageId)
    }
    const { id } = await createSession(withImages(plainIds[0]!, plainIds[1]!))
    await page.goto(`/s/${id}`)
    await decoded(page, TOP_ALT)

    const sealedIds: string[] = []
    page.on('response', async (res) => {
      if (res.url().endsWith(`/api/session/${id}/image`) && res.status() === 201) {
        sealedIds.push(((await res.json()) as { imageId: string }).imageId)
      }
    })
    const dialog = await archiveWithPassword(page, isMobile)
    await expect(page.getByRole('status').filter({ hasText: 'Archived. Kept 90 days from last open.' })).toBeVisible()
    await expect(dialog).not.toBeVisible()

    for (const plain of plainIds) {
      const gone = await request.get(`${API_URL}/api/image/${plain}`)
      expect(gone.status()).toBe(404)
      expect(await gone.json()).toEqual({ error: 'Image not found or expired.' })
    }
    await expect.poll(() => sealedIds.length).toBe(2)
    for (const sealed of sealedIds) {
      const served = await request.get(`${API_URL}/api/image/${sealed}`)
      expect(served.status()).toBe(200)
      expect(served.headers()['content-type']).toBe('application/octet-stream')
      expect(Buffer.from(await served.body()).includes(PNG)).toBe(false)
    }

    await page.reload()
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Unlock' }).click()
    await decoded(page, TOP_ALT)
    await page.locator('summary', { hasText: 'More charts' }).click()
    await decoded(page, NESTED_ALT)
  })

  test('a failed image upload leaves the brief unarchived, its plaintext images served, with the fixed error', async ({
    page,
    request,
    createSession,
    isMobile,
  }) => {
    const upload = await request.post(`${API_URL}/api/image`, { headers: { 'content-type': 'image/png' }, data: PNG })
    const { imageId } = (await upload.json()) as { imageId: string }
    const second = await request.post(`${API_URL}/api/image`, { headers: { 'content-type': 'image/png' }, data: PNG })
    const { imageId: nestedId } = (await second.json()) as { imageId: string }
    const { id } = await createSession(withImages(imageId, nestedId))
    await page.goto(`/s/${id}`)
    await decoded(page, TOP_ALT)

    let saves = 0
    page.on('request', (req) => {
      if (req.url().endsWith(`/api/session/${id}/save`)) saves++
    })
    let uploads = 0
    await page.route(`${API_URL}/api/session/${id}/image`, async (route) => {
      uploads++
      if (uploads === 1) return route.continue()
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Internal error."}' })
    })
    await archiveWithPassword(page, isMobile)

    await expect(page.getByText('Could not archive. Nothing was changed.')).toBeVisible()
    expect(uploads).toBe(2)
    expect(saves).toBe(0)

    const envelope = await request.get(`${API_URL}/api/session/${id}`)
    expect(((await envelope.json()) as { encrypted: boolean }).encrypted).toBe(false)
    for (const plain of [imageId, nestedId]) {
      const served = await request.get(`${API_URL}/api/image/${plain}`)
      expect(served.status()).toBe(200)
      expect(served.headers()['content-type']).toBe('image/png')
    }
  })
})
