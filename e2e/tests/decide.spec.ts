import { test, expect, testPayload } from './fixtures'
import type { Page } from '@playwright/test'
import type { Payload } from '@brief/schema'

const [d1, d2] = testPayload.decisions
if (!d1 || !d2) throw new Error('fixture payload changed shape')

/** The dock: a column beside the document, or under 880 the bottom sheet behind "Open dock" (B-Mobile). */
async function openDock(page: Page, isMobile: boolean) {
  if (!isMobile) return page.getByRole('complementary', { name: 'Decision dock' })
  await page.getByRole('button', { name: 'Open dock' }).click()
  return page.getByRole('dialog', { name: 'Decision dock' })
}

test.describe('decide', () => {
  test('the review opens with open questions and the reply prompt carries every answer, Other included', async ({
    page,
    createSession,
    isMobile,
  }) => {
    const { id } = await createSession()
    await page.goto(`/s/${id}`)
    const dock = await openDock(page, isMobile)
    const question = (decisionId: string) =>
      dock.getByRole('group', { name: `Question ${decisionId}` })

    // The sheet shows one question at a time and opens on the first open one.
    await expect(question(d1.id).getByText(d1.q)).toBeVisible()
    await question(d1.id).getByRole('radio', { name: d1.opts[0]!.label }).click()

    // D5: the review opens with questions still open; they print "(not answered)".
    await dock.getByRole('button', { name: /^Copy prompt for agent/ }).click()
    const review = page.getByRole('dialog', { name: 'Review prompt before copying' })
    const promptText = review.getByRole('textbox', { name: 'Prompt text' })
    await expect(promptText).toHaveValue(/^Reply to/)
    await expect(promptText).toHaveValue(
      new RegExp(`\\[${d1.id}\\][^\\n]*\\n  - Choice: ${d1.opts[0]!.label}\\n`),
    )
    await expect(promptText).toHaveValue(
      new RegExp(`\\[${d2.id}\\][^\\n]*\\n  - Choice: \\(not answered\\)\\n`),
    )

    // "Go to d2" closes the review and lands on the open question.
    await review.getByRole('button', { name: `Go to ${d2.id}` }).click()
    await expect(review).toBeHidden()
    await expect(question(d2.id).getByText(d2.q)).toBeVisible()
    await question(d2.id).getByRole('checkbox', { name: d2.opts[0]!.label }).click()
    await question(d2.id).getByRole('checkbox', { name: 'Other, type your own' }).click()
    await question(d2.id)
      .getByRole('textbox', { name: /Your answer$/ })
      .fill('Offline mode')

    await dock.getByRole('button', { name: /^Copy prompt for agent/ }).click()
    await expect(promptText).toHaveValue(
      new RegExp(
        `\\[${d2.id}\\][^\\n]*\\n  - Choice: ${d2.opts[0]!.label}; Other: Offline mode\\n`,
      ),
    )
    await expect(promptText).not.toHaveValue(/not answered/)
  })

  test('a reload keeps an Other answer', async ({ page, createSession, isMobile }) => {
    const { id } = await createSession()
    await page.goto(`/s/${id}`)
    let dock = await openDock(page, isMobile)
    await dock
      .getByRole('group', { name: `Question ${d1.id}` })
      .getByRole('radio', { name: 'Other, type your own' })
      .click()
    await dock.getByRole('textbox', { name: /Your answer$/ }).fill('Solarized')
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), `idocs:${id}`))
      .toContain('Solarized')

    await page.reload()
    dock = await openDock(page, isMobile)
    const q1 = dock.getByRole('group', { name: `Question ${d1.id}` })
    if (isMobile) await dock.getByRole('button', { name: `Question ${d1.id}` }).click()
    await expect(q1.getByRole('radio', { name: 'Other, type your own' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(q1.getByRole('textbox', { name: /Your answer$/ })).toHaveValue('Solarized')
  })
})

function focusVisibility(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement
    const row = el?.closest<HTMLElement>('[data-decision]')
    const labelledBy = el?.closest('[aria-labelledby]')?.getAttribute('aria-labelledby')
    const question = labelledBy ? document.getElementById(labelledBy) : null
    if (!el || !row?.parentElement || !question) return { decision: null }
    const list = row.parentElement.getBoundingClientRect()
    const visibleInList = (target: Element) => {
      const r = target.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return r.top >= list.top - 0.5 && r.bottom <= list.bottom + 0.5 && !!hit && target.contains(hit)
    }
    return { decision: row.dataset.decision, option: visibleInList(el), question: visibleInList(question) }
  })
}

test.describe('dock edges', () => {
  const tall: Payload = {
    ...testPayload,
    decisions: [
      {
        ...d1,
        why: 'A long explanation so the first decision is taller than the dock list at a laptop height.',
        opts: Array.from({ length: 8 }, (_, i) => ({
          id: `o${i}`,
          label: `Option ${i + 1} for the limiter`,
          detail: 'A detail line that explains the option',
        })),
        cmp: {
          head: ['Option', 'Latency', 'Accuracy', 'Cost'],
          rows: Array.from({ length: 6 }, (_, i) => [`Option ${i + 1}`, '~1 ms', 'exact', 'low']),
        },
      },
      d2,
    ],
  }

  for (const { width, height, rowTallerThanList } of [
    { width: 1440, height: 700, rowTallerThanList: true },
    { width: 1440, height: 900, rowTallerThanList: false },
    { width: 1100, height: 700, rowTallerThanList: false },
    { width: 900, height: 700, rowTallerThanList: false },
  ]) {
    test(`N shows the question and its focused option at ${width}x${height}`, async ({
      page,
      createSession,
      isMobile,
    }) => {
      test.skip(isMobile, 'the dock is a column only from 880')
      await page.setViewportSize({ width, height })
      const { id } = await createSession(tall)
      await page.goto(`/s/${id}`)
      const d1Row = page.getByRole('complementary', { name: 'Decision dock' }).locator(`[data-decision="${d1.id}"]`)
      await expect(d1Row).toBeAttached()
      const [rowHeight, listHeight] = await d1Row.evaluate((el: HTMLElement) => [el.offsetHeight, el.parentElement!.clientHeight])
      expect(rowHeight > listHeight).toBe(rowTallerThanList)

      for (const want of [d1.id, d2.id, d1.id]) {
        await page.keyboard.press('n')
        await expect.poll(() => focusVisibility(page)).toEqual({ decision: want, option: true, question: true })
      }
    })
  }
})
