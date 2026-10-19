import type { Page } from '@playwright/test'
import { test, expect, testPayload } from './fixtures'

/** WCAG relative luminance of the faint text token over the page background, read from the running CSS. */
async function faintOnPage(page: Page): Promise<number> {
  return page.evaluate(() => {
    const probe = document.createElement('span')
    probe.style.cssText = 'color: var(--c-faint); background-color: var(--c-page)'
    document.body.append(probe)
    const style = getComputedStyle(probe)
    const rgb = (c: string) => (c.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number)
    const lum = (c: string) => {
      const [r = 0, g = 0, b = 0] = rgb(c).map((v) => {
        const x = v / 255
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const [a, b] = [lum(style.color), lum(style.backgroundColor)]
    probe.remove()
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  })
}

for (const theme of ['light', 'dark'] as const) {
  test(`faint text on the page background reaches 4.5:1 in ${theme}`, async ({ page, createSession }) => {
    await page.emulateMedia({ colorScheme: theme })
    const { id } = await createSession(testPayload)
    await page.goto(`/s/${id}`)
    await expect(page.getByRole('heading', { name: 'Introduction' })).toBeVisible()
    expect(await faintOnPage(page)).toBeGreaterThanOrEqual(4.5)
  })
}
