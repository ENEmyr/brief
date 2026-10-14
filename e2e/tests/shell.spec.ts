import type { Page } from '@playwright/test'
import { test, expect, testPayload, API_URL } from './fixtures'

/** Waits until a smooth scroll has stopped: J and K measure from where the page is. */
async function scrollSettled(page: Page): Promise<void> {
  let last = -1
  await expect
    .poll(async () => {
      const now = await page.evaluate(() => window.scrollY)
      const still = now === last
      last = now
      return still
    }, { intervals: [100] })
    .toBe(true)
}

// The Console reader shell (Phase 2): command palette, keyboard map, view
// tabs and the save chip. The wide controls hide under 880, so these run on
// the desktop project; the mobile shell is covered by mobile-outline.spec.ts
// and the visual suite.
test.describe('reader shell', () => {
  test.beforeEach(async ({ isMobile }) => {
    test.skip(isMobile, 'the palette field, view tabs and save chip are wide-screen controls (B-Reader)')
  })

  test('palette: Ctrl/Cmd K opens it, it filters, arrows move, Enter jumps and flashes, focus comes back', async ({
    page,
    createSession,
  }) => {
    const { id } = await createSession()
    await page.goto(`/s/${id}`)
    await expect(page.getByRole('heading', { level: 1, name: testPayload.meta.title })).toBeVisible()

    const field = page.getByRole('button', { name: /Jump to\.\.\./ })
    await field.focus()
    await page.keyboard.press('ControlOrMeta+k')
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await expect(palette).toBeVisible()
    const input = palette.getByRole('combobox', { name: 'Search the brief' })
    await expect(input).toBeFocused()

    // An inner click must not close it (the board stops propagation on the panel).
    await palette.getByText('SECTIONS').click()
    await expect(palette).toBeVisible()
    await input.focus()

    await input.fill('flow')
    const options = palette.getByRole('option')
    await expect(options.first()).toHaveAttribute('aria-selected', 'true')
    const count = await options.count()
    expect(count).toBeGreaterThan(1)
    await page.keyboard.press('ArrowDown')
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowUp')
    await expect(options.first()).toHaveAttribute('aria-selected', 'true')

    await input.fill('Flow')
    const sectionRow = palette.getByRole('option', { name: /02\s*Flow/ })
    await sectionRow.hover()
    await page.keyboard.press('Enter')
    await expect(palette).toBeHidden()
    await expect(page.locator('section#flow')).toHaveAttribute('data-flash', /^[ab]$/)
    await expect(field).toBeFocused()

    await field.click()
    await expect(palette).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(palette).toBeHidden()
    await expect(field).toBeFocused()
  })

  test('palette: a query with no match shows the B-States hint', async ({ page, createSession }) => {
    const { id } = await createSession()
    await page.goto(`/s/${id}`)
    await page.getByRole('button', { name: /Jump to\.\.\./ }).click()
    await page.getByRole('combobox', { name: 'Search the brief' }).fill('quota')
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toContainText(
      'No match for "quota". Try a section title, a decision id like D2, or a term.',
    )
  })

  test('J and K move between sections; ? lists the working shortcuts; letters are ignored in a text field', async ({
    page,
    createSession,
  }) => {
    const { id } = await createSession()
    await page.goto(`/s/${id}`)
    await expect(page.getByRole('heading', { level: 1, name: testPayload.meta.title })).toBeVisible()

    await page.keyboard.press('j')
    await expect(page.locator('section#intro')).toHaveAttribute('data-flash', /^[ab]$/)
    await scrollSettled(page)
    // The card lands on its 72px scroll margin under the top bar.
    expect(await page.locator('section#intro').evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(72)
    await page.keyboard.press('j')
    await expect(page.locator('section#flow')).toHaveAttribute('data-flash', /^[ab]$/)
    await expect(page.locator('section#intro')).not.toHaveAttribute('data-flash')
    await scrollSettled(page)
    await page.keyboard.press('k')
    await expect(page.locator('section#intro')).toHaveAttribute('data-flash', /^[ab]$/)

    await page.keyboard.press('?')
    const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
    await expect(sheet).toBeVisible()
    await expect(sheet).toContainText('command palette and search')
    await expect(sheet).toContainText('next and previous section')
    await expect(sheet).toContainText('show all shortcuts')
    await expect(sheet).toContainText('pick an option in the focused question')
    await expect(sheet).toContainText('jump to next unanswered question')
    await expect(sheet).toContainText('copy the prompt')
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()

    // A letter typed into a field is text, not a shortcut.
    const reason = page.getByRole('complementary', { name: 'Decision dock' }).getByRole('textbox').first()
    await reason.fill('')
    await reason.press('j')
    await expect(reason).toHaveValue('j')
    await expect(page.locator('section#intro')).toHaveAttribute('data-flash', /^[ab]$/)
  })

  test('N jumps to the next open question, 1 to 9 pick in it, and Cmd or Ctrl Enter copies from the dock', async ({
    page,
    createSession,
  }) => {
    const [d1, d2] = testPayload.decisions
    const { id } = await createSession()
    await page.goto(`/s/${id}`)
    const dock = page.getByRole('complementary', { name: 'Decision dock' })
    await expect(dock.getByText(d1!.q)).toBeVisible()

    await page.keyboard.press('n')
    const first = dock.getByRole('group', { name: `Question ${d1!.id}` }).getByRole('radio', { name: d1!.opts[0]!.label })
    await expect(first).toBeFocused()
    await page.keyboard.press('2')
    await expect(dock.getByRole('radio', { name: d1!.opts[1]!.label })).toHaveAttribute('aria-checked', 'true')

    await page.keyboard.press('n')
    const q2 = dock.getByRole('group', { name: `Question ${d2!.id}` })
    await expect(q2.getByRole('checkbox', { name: d2!.opts[0]!.label })).toBeFocused()
    // The last number is Other; it opens "Your answer" and moves the caret there.
    await page.keyboard.press(String(d2!.opts.length + 1))
    await expect(q2.getByRole('textbox', { name: `${d2!.id} Your answer` })).toBeFocused()
    await page.keyboard.type('5')
    await expect(q2.getByRole('textbox', { name: `${d2!.id} Your answer` })).toHaveValue('5')

    await page.keyboard.press('ControlOrMeta+Enter')
    const review = page.getByRole('dialog', { name: 'Review prompt before copying' })
    await expect(review.getByRole('textbox', { name: 'Prompt text' })).toHaveValue(/Other: 5\n/)
  })

  test('view tabs: Diagrams keeps diagram blocks only, Raw shows the markdown export', async ({
    page,
    createSession,
  }) => {
    const { id } = await createSession()
    await page.goto(`/s/${id}`)
    const tabs = page.getByRole('tablist', { name: 'View' })

    await tabs.getByRole('tab', { name: 'Diagrams' }).click()
    await expect(tabs.getByRole('tab', { name: 'Diagrams' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('Request flow')).toBeVisible()
    await expect(page.locator('main section')).toHaveCount(1)
    await expect(page.getByRole('table')).toHaveCount(0)

    await tabs.getByRole('tab', { name: 'Raw' }).click()
    const raw = page.getByLabel('Raw markdown')
    await expect(raw).toContainText(`# ${testPayload.meta.title}`)
    await expect(raw).toContainText(`/s/${id}`)
    await expect(page.locator('main section')).toHaveCount(0)

    // The outline still reaches a section from Raw: it switches back to Document.
    await page.getByRole('navigation', { name: 'Outline' }).getByRole('link', { name: /01\s*Introduction/ }).click()
    await expect(tabs.getByRole('tab', { name: 'Document' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('section#intro')).toHaveAttribute('data-flash', /^[ab]$/)
  })

  test('save chip: saving after an edit, then "this device" when the sync PUT fails', async ({
    page,
    createSession,
  }) => {
    const { id } = await createSession()
    await page.route(`${API_URL}/api/session/${id}/state`, (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({ status: 500, headers: { 'access-control-allow-origin': '*' }, body: '{}' })
        : route.fallback(),
    )
    await page.goto(`/s/${id}`)
    const chip = page.locator('header').getByRole('status')
    await expect(chip).toHaveText('saved')

    const d1 = testPayload.decisions[0]!
    await page.getByRole('radio', { name: d1.opts[0]!.label }).click()
    await expect(chip).toHaveText('saving')
    // The sync debounce is 5 seconds.
    await expect(chip).toHaveText('this device', { timeout: 10_000 })
  })
})
