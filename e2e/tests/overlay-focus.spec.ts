import type { Page } from '@playwright/test'
import type { Block, Payload } from '@brief/schema'
import { test, expect } from './fixtures'

const filler = (label: string): Block[] =>
  Array.from({ length: 24 }, (_, i) => ({ type: 'p', text: `${label} paragraph ${i + 1} keeps this section taller than the viewport.` }))

const opts = [
  { id: 'a', label: 'Alpha choice' },
  { id: 'b', label: 'Beta choice' },
]

const payload: Payload = {
  meta: { title: 'Overlay focus' },
  sections: [
    { id: 'intro', no: 1, title: 'Introduction', blocks: [{ type: 'p', text: 'The token bucket refills.' }, ...filler('Intro')] },
    { id: 'bucket', no: 2, title: 'Token bucket', blocks: [{ type: 'p', text: 'The bucket refills at a fixed rate.' }] },
    { id: 'tail', no: 3, title: 'Rollout', blocks: filler('Rollout') },
  ],
  decisions: [{ id: 'D1', q: 'Which limiter?', multi: false, opts, refs: ['bucket'] }],
  glossary: [{ term: 'token bucket', def: 'A counter that refills at a fixed rate.' }],
}

/** Jump through D1's context chip in the desktop dock column, so the Back pill shows. */
async function showBackPill(page: Page) {
  const dock = page.getByRole('complementary', { name: 'Decision dock' })
  await dock.getByRole('group', { name: 'Question D1' }).getByRole('link').click()
  const pill = page.getByRole('button', { name: 'Back to D1' })
  await expect(pill).toBeVisible()
  return { dock, pill }
}

test.describe('overlays share one focus and Escape contract', () => {
  test('the phone dock sheet opened with nothing focused hands focus to Open dock on close', async ({
    page,
    createSession,
    isMobile,
  }) => {
    test.skip(!isMobile, 'the sheet exists under 880 only')
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)
    const openDock = page.getByRole('button', { name: 'Open dock' })
    const sheet = page.getByRole('dialog', { name: 'Decision dock' })

    for (const close of ['Escape', 'Close dock'] as const) {
      // A tap in Safari opens the sheet without focusing the button: focus stays on the body.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      await openDock.dispatchEvent('click')
      await expect(sheet).toBeVisible()
      if (close === 'Escape') await page.keyboard.press('Escape')
      else await sheet.getByRole('button', { name: 'Close dock' }).click()
      await expect(sheet).toBeHidden()
      await expect(openDock).toBeFocused()
    }
  })

  test('Escape that closes a dialog leaves the Back pill up', async ({ page, createSession, isMobile }) => {
    test.skip(isMobile, 'the shortcut sheet opens from a keyboard key')
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)
    const { pill } = await showBackPill(page)

    await page.keyboard.press('?')
    const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
    await expect(sheet).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(pill).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(pill).toBeHidden()
  })

  test('from 880 a toast does not cover the Back pill', async ({ page, createSession, isMobile }) => {
    test.skip(isMobile, 'under 880 the pill sits above the peek bar, clear of the toast')
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.clock.install()
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)
    const { dock, pill } = await showBackPill(page)

    // The toast leaves after 1.6s, and under load the steps below can take longer:
    // stop page timers so the toast stays until it is measured.
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000)
    await dock.getByRole('button', { name: /^Copy prompt for agent/ }).click()
    const toast = page.locator('[data-toast]')
    await expect(toast).toBeVisible()
    // The review sheet opens with the toast; closing it leaves the toast and the pill on the page.
    const review = page.getByRole('dialog', { name: 'Review prompt before copying' })
    await review.getByRole('button', { name: 'Close prompt review' }).click()
    await expect(review).toBeHidden()
    await expect(toast).toBeVisible()
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
    const p = (await pill.boundingBox())!
    const t = (await toast.boundingBox())!
    expect(p.y + p.height, 'the pill ends above the toast').toBeLessThanOrEqual(t.y)
    const hit = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-back-pill]') !== null,
      { x: p.x + p.width / 2, y: p.y + p.height / 2 },
    )
    expect(hit, 'the pill can be hit at its centre').toBe(true)
  })

  test('the glossary popover with links is a dialog, not a tooltip', async ({ page, createSession, isMobile }) => {
    test.skip(isMobile, 'hover is desktop input')
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)
    const term = page.locator('[data-term="1"]').first()
    await term.hover()
    const tip = page.getByRole('dialog', { name: 'token bucket' })
    await expect(tip).toBeVisible()
    await expect(tip.getByRole('button', { name: '§01' })).toBeVisible()
    await expect(page.getByRole('tooltip')).toHaveCount(0)
    await expect(term).toHaveAttribute('aria-haspopup', 'dialog')
  })
})
