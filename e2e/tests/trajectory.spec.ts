import type { Page } from '@playwright/test'
import type { Payload } from '@brief/schema'
import { test, expect, testPayload, API_URL } from './fixtures'

const DECIDED = 'key = API key, fallback IP'

const [first, ...rest] = testPayload.sections
if (!first) throw new Error('fixture payload changed shape')
const bid = first.blocks.length

const payload: Payload = {
  ...testPayload,
  sections: [
    {
      ...first,
      blocks: [
        ...first.blocks,
        {
          type: 'trajectory',
          stats: { seconds: 252, tokens: 38_200 },
          steps: [
            { at: '2026-10-15T01:00:00Z', kind: 'request', title: 'Do not touch the webhook endpoints', detail: 'first prompt' },
            { at: '2026-10-15T01:00:14Z', kind: 'read', title: 'src/router.ts, wrangler.toml', detail: '2 files / 340 lines' },
            { at: '2026-10-15T01:00:52Z', kind: 'decision', title: DECIDED, flag: true },
            { at: '2026-10-15T01:01:30Z', kind: 'edit', title: 'src/limiter.ts' },
            { at: '2026-10-15T01:02:05Z', kind: 'assumption', title: 'Webhooks come from a fixed IP range', flag: true },
          ],
        },
      ],
    },
    ...rest,
  ],
}

async function openDock(page: Page, isMobile: boolean) {
  if (!isMobile) return page.getByRole('complementary', { name: 'Decision dock' })
  await page.getByRole('button', { name: 'Open dock' }).click()
  return page.getByRole('dialog', { name: 'Decision dock' })
}

test.describe('trajectory', () => {
  test('filters by keyboard and mouse, and an Ask me mark persists, syncs and reaches the prompt', async ({
    page,
    request,
    createSession,
    isMobile,
  }) => {
    const { id } = await createSession(payload)
    const stateUrl = `${API_URL}/api/session/${id}/state`
    const firstGet = page.waitForResponse((res) => res.url() === stateUrl && res.request().method() === 'GET')
    await page.goto(`/s/${id}`)
    await firstGet

    const offset = page.locator('time', { hasText: '00:52' })
    await expect(offset).toHaveAttribute('title', '2026-10-15T01:00:52Z')

    const panel = page.getByRole('tabpanel', { name: 'Steps' })
    await page.getByRole('tab', { name: 'all 5' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: 'decided 1' })).toHaveAttribute('aria-selected', 'true')
    await expect(panel.getByText('src/limiter.ts')).toHaveCount(0)
    await page.getByRole('tab', { name: 'edits 1' }).click()
    await expect(panel.getByText('src/limiter.ts')).toBeVisible()
    await expect(panel.getByText(DECIDED)).toHaveCount(0)
    await page.getByRole('tab', { name: 'all 5' }).click()

    const put = page.waitForResponse((res) => res.url() === stateUrl && res.request().method() === 'PUT' && res.ok())
    await page.getByRole('group', { name: DECIDED }).getByRole('button', { name: 'Ask me' }).click()
    await put
    await expect
      .poll(async () => {
        const { state } = (await (await request.get(stateUrl)).json()) as { state: string | null }
        return state === null ? null : (JSON.parse(state) as { tflag?: unknown }).tflag
      })
      .toEqual({ [`0.${bid}`]: { '2': 'ask' } })

    await page.reload()
    await expect(page.getByRole('group', { name: DECIDED }).getByRole('button', { name: 'Ask me' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    const dock = await openDock(page, isMobile)
    await dock.getByRole('button', { name: /^Copy prompt for agent/ }).click()
    const promptText = page.getByRole('dialog', { name: 'Review prompt before copying' }).getByRole('textbox', { name: 'Prompt text' })
    await expect(promptText).toHaveValue(/\nFlags \(steps the agent decided alone or assumed\):\n {2}- Ask me: 00:52 decided - key = API key, fallback IP\n/)
  })
})
