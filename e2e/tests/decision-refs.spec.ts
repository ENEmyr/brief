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
  meta: { title: 'Decision refs' },
  sections: [
    { id: 'intro', no: 1, title: 'Introduction', blocks: filler('Intro') },
    { id: 'bucket', no: 2, title: 'Token bucket', blocks: [{ type: 'p', text: 'The bucket refills at a fixed rate.' }] },
    { id: 'tail', no: 3, title: 'Rollout', blocks: filler('Rollout') },
  ],
  decisions: [
    { id: 'D1', q: 'Which limiter?', multi: false, opts, refs: ['bucket', 'missing'] },
    { id: 'D2', q: 'Default limit?', multi: false, opts },
    { id: 'D3', q: 'Key on what?', multi: false, opts, refs: [] },
    { id: 'D4', q: 'Over the limit?', multi: false, opts, refs: ['gone'] },
  ],
}

/** The decision dock: the column, or under 880 the sheet behind "Open dock" (B-Mobile). */
async function openDock(page: Page, isMobile: boolean) {
  if (!isMobile) return page.getByRole('complementary', { name: 'Decision dock' })
  await page.getByRole('button', { name: 'Open dock' }).click()
  return page.getByRole('dialog', { name: 'Decision dock' })
}

async function focusedDecision(page: Page): Promise<string | undefined> {
  return page.evaluate(() => document.activeElement?.closest<HTMLElement>('[data-decision]')?.dataset.decision)
}

test.describe('decision context chips (D7)', () => {
  test('a chip jumps to its section, flashes it, and the Back pill returns to the decision', async ({
    page,
    createSession,
    isMobile,
  }) => {
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)
    const dock = await openDock(page, isMobile)
    const d1 = dock.getByRole('group', { name: 'Question D1' })
    const chips = d1.getByRole('link')
    await expect(chips).toHaveCount(1)
    // R-V6 (D6): under 880 the sheet chip adds the English context hint after the title.
    await expect(chips).toHaveText(
      isMobile ? '§02Token bucketRead the context; the dock shrinks to a bar' : '§02Token bucket',
    )

    const section = page.locator('main [data-section="bucket"]')
    await expect(section).not.toHaveAttribute('data-flash')
    await chips.click()
    await expect(section).toHaveAttribute('data-flash', /^[ab]$/)
    await expect(section).toBeInViewport()
    if (isMobile) await expect(page.getByRole('dialog', { name: 'Decision dock' })).toBeHidden()

    const pill = page.getByRole('button', { name: 'Back to D1' })
    await expect(pill).toBeVisible()
    await pill.click()
    await expect(pill).toBeHidden()
    await expect.poll(() => focusedDecision(page)).toBe('D1')
  })

  test('Enter on a chip jumps the same way, and Escape or scrolling away hides the pill', async ({
    page,
    createSession,
    isMobile,
  }) => {
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)
    const dock = await openDock(page, isMobile)
    const chip = dock.getByRole('group', { name: 'Question D1' }).getByRole('link')
    const section = page.locator('main [data-section="bucket"]')
    const pill = page.getByRole('button', { name: 'Back to D1' })

    await chip.focus()
    await page.keyboard.press('Enter')
    await expect(section).toHaveAttribute('data-flash', /^[ab]$/)
    await expect(section).toBeInViewport()
    await expect(pill).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(pill).toBeHidden()

    const dockAgain = await openDock(page, isMobile)
    await dockAgain.getByRole('group', { name: 'Question D1' }).getByRole('link').click()
    await expect(pill).toBeVisible()
    await expect(section).toBeInViewport()
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(section).not.toBeInViewport()
    await expect(pill).toBeHidden()
  })

  test('under 880 the open sheet covers the pill', async ({ page, createSession, isMobile }) => {
    test.skip(!isMobile, 'the sheet exists under 880 only')
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)
    const dock = await openDock(page, true)
    await dock.getByRole('group', { name: 'Question D1' }).getByRole('link').click()
    const pill = page.getByRole('button', { name: 'Back to D1' })
    await expect(pill).toBeVisible()
    const box = (await pill.boundingBox())!

    await openDock(page, true)
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
    const topmost = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-back-pill]') === null,
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    )
    expect(topmost).toBe(true)
  })

  test('no refs, empty refs and refs that resolve to no section render no chips', async ({
    page,
    createSession,
    isMobile,
  }) => {
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)
    const dock = await openDock(page, isMobile)
    for (const decisionId of ['D2', 'D3', 'D4']) {
      if (isMobile) await dock.getByRole('button', { name: `Question ${decisionId}` }).click()
      const question = dock.getByRole('group', { name: `Question ${decisionId}` })
      await expect(question).toBeVisible()
      await expect(question.getByRole('link')).toHaveCount(0)
      await expect(question.getByText('context', { exact: true })).toHaveCount(0)
    }
  })
})
