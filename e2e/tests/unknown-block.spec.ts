import type { Payload } from '@brief/schema'
import { test, expect, API_URL } from './fixtures'

const XSS = '<img src=x onerror="window.__xss=1">'

const payload: Payload = {
  meta: { title: 'Stored unknown block' },
  sections: [
    {
      id: 'stored',
      no: 1,
      title: 'Stored',
      blocks: [
        { type: 'p', text: 'Before the unknown block.' },
        { type: 'p', text: 'After the unknown block.' },
        { type: 'details', summary: 'More', blocks: [{ type: 'p', text: 'Inside details.' }] },
      ],
    },
  ],
  decisions: [],
}

const hologram = { type: 'hologram', frames: 3, caption: XSS }

// POST validates with payloadSchema, so a block from a newer or rolled-back
// schema can only reach the reader as a row already in storage. GET returns
// that row's payload string verbatim; this puts the unknown block into it.
test('a stored block of an unknown type renders as raw JSON in its card, not as a failed document', async ({
  page,
  createSession,
}) => {
  const { id } = await createSession(payload)
  await page.route(`${API_URL}/api/session/${id}`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const response = await route.fetch()
    const body = await response.json()
    const stored = JSON.parse(body.payload)
    stored.sections[0].blocks.splice(1, 0, hologram)
    stored.sections[0].blocks[3].blocks.push(hologram)
    await route.fulfill({ response, json: { ...body, payload: JSON.stringify(stored) } })
  })

  await page.goto(`/s/${id}`)
  await expect(page.getByText('Before the unknown block.')).toBeVisible()
  await expect(page.getByText('After the unknown block.')).toBeVisible()

  const section = page.locator('section#stored')
  const cards = section.locator('figure:has(> div > [data-kind-tag]:text-is("hologram"))')
  await expect(cards.first()).toBeVisible()
  await expect(cards.first()).toContainText('not supported here')
  await cards.first().getByText('Show raw block').click()
  const raw = cards.first().locator('details pre')
  await expect(raw).toContainText('"frames": 3')
  await expect(raw).toContainText(`"caption": ${JSON.stringify(XSS)}`)

  await section.getByText('More', { exact: true }).click()
  await expect(section.getByText('Inside details.')).toBeVisible()
  await expect(cards).toHaveCount(2)

  await expect(page.locator('img[src="x"]')).toHaveCount(0)
  expect(await page.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined()
})
