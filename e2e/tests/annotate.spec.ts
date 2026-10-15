import type { Page } from '@playwright/test'
import {
  test,
  expect,
  selectFirstParagraphText,
  dragAcross,
  FIRST_PARAGRAPH_SELECTOR,
  FIRST_CODE_LINE_SELECTOR,
} from './fixtures'

async function addNote(page: Page, note: string) {
  await page.getByRole('button', { name: 'Note' }).click()
  await page.getByPlaceholder('Write a short note…').fill(note)
  await page.getByRole('button', { name: 'Done', exact: true }).click()
}

function storedHighlightTexts(page: Page, sessionId: string): Promise<string[]> {
  return page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key) ?? '{}') as {
      highlights?: { text: string }[]
    }
    return (stored.highlights ?? []).map((h) => h.text)
  }, `idocs:${sessionId}`)
}

test.describe('annotate', () => {
  test('selecting text shows the toolbar and Highlight adds a mark', async ({ page, createSession }) => {
    const { id } = await createSession()
    await page.goto(`/s/${id}`)

    const selected = await selectFirstParagraphText(page)
    expect(selected.length).toBeGreaterThan(0)

    const highlightButton = page.getByRole('button', { name: 'Highlight' })
    await expect(highlightButton).toBeVisible()
    await highlightButton.click()

    // The mark must contain exactly the selected characters -- a mark
    // rendered at drifted offsets (an off-by-one in the Range -> start/end
    // offset mapping) would still pass a bare visibility check.
    const mark = page.locator(FIRST_PARAGRAPH_SELECTOR).locator('mark')
    await expect(mark).toBeVisible()
    await expect(mark).toHaveText(selected)
  })

  for (const { leaf, selector, noted, later } of [
    { leaf: 'paragraph', selector: FIRST_PARAGRAPH_SELECTOR, noted: 'This', later: 'toolbar' },
    { leaf: 'code line', selector: FIRST_CODE_LINE_SELECTOR, noted: 'console', later: 'hello' },
  ]) {
    test(`a highlight after a noted mark in a ${leaf} is drawn and survives reload`, async ({
      page,
      createSession,
    }) => {
      const { id } = await createSession()
      await page.goto(`/s/${id}`)
      const marks = page.locator(selector).locator('mark')

      await dragAcross(page, selector, noted)
      await addNote(page, `${leaf} note`)
      await dragAcross(page, selector, later)
      await page.getByRole('button', { name: 'Highlight' }).click()

      await expect(marks).toHaveText([noted, later])
      const marker = await marks.first().evaluate((mark) => getComputedStyle(mark, '::after').content)
      expect(marker).toContain('●')

      // The reader saves its state to localStorage on a timer after the click.
      // Reloading before that write lands loses the second highlight.
      await expect.poll(() => storedHighlightTexts(page, id)).toEqual([noted, later])
      await page.reload()
      await expect(marks).toHaveText([noted, later])
    })
  }

  test('note and ask markers show in both themes, are announced, and print as labels', async ({
    page,
    createSession,
  }) => {
    const { id } = await createSession()
    await page.goto(`/s/${id}`)
    const marks = page.locator(FIRST_PARAGRAPH_SELECTOR).locator('mark')

    await dragAcross(page, FIRST_PARAGRAPH_SELECTOR, 'This')
    await addNote(page, 'paragraph note')
    await dragAcross(page, FIRST_PARAGRAPH_SELECTOR, 'toolbar')
    await page.getByRole('button', { name: 'Ask' }).click()
    await page.getByPlaceholder('Type a question about this part…').fill('why?')
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(marks).toHaveText(['This', 'toolbar'])
    await expect.poll(() => storedHighlightTexts(page, id)).toEqual(['This', 'toolbar'])

    for (const [theme, accentText] of [
      ['light', 'rgb(77, 122, 0)'],
      ['dark', 'rgb(197, 240, 90)'],
    ] as const) {
      await page.evaluate((t) => localStorage.setItem('idocs:theme', t), theme)
      await page.reload()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await expect(marks).toHaveText(['This', 'toolbar'])
      const markers = await marks.evaluateAll((els) =>
        els.map((el) => {
          const after = getComputedStyle(el, '::after')
          return { marker: el.getAttribute('data-marker'), content: after.content, color: after.color }
        }),
      )
      expect(markers).toEqual([
        { marker: 'note', content: '"●" / "note"', color: accentText },
        { marker: 'ask', content: '"?" / "question"', color: accentText },
      ])
    }

    const cdp = await page.context().newCDPSession(page)
    const { result } = await cdp.send('Runtime.evaluate', {
      expression: `document.querySelector(${JSON.stringify(FIRST_PARAGRAPH_SELECTOR)})`,
    })
    const spokenIn = async (accessibleName: string) => {
      const { nodes } = await cdp.send('Accessibility.queryAXTree', { objectId: result.objectId, accessibleName })
      return nodes.filter((n) => n.role?.value === 'StaticText').length
    }
    expect(await spokenIn('note')).toBe(1)
    expect(await spokenIn('question')).toBe(1)
    expect(await spokenIn('●')).toBe(0)

    await page.emulateMedia({ media: 'print' })
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
    const printed = page.locator(`${FIRST_PARAGRAPH_SELECTOR} [data-print-note]`)
    await expect(printed).toHaveText(['Note: paragraph note', 'Question: why?'])
    await expect(printed.locator('b')).toHaveText(['Note:', 'Question:'])
    expect(await marks.evaluateAll((els) => els.map((el) => getComputedStyle(el, '::after').content))).toEqual([
      'none',
      'none',
    ])
  })
})
