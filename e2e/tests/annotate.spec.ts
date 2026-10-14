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

      await page.reload()
      await expect(marks).toHaveText([noted, later])
    })
  }
})
