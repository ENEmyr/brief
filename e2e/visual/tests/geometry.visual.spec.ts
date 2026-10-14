import { expectBox, expectComputed } from '../lib/geometry'
import { READER_REGIONS, type Theme } from '../lib/regions'
import { openReader, test } from '../lib/session'

// Numbers measured on B-Reader and B-Reader-Light at 1440 (getBoundingClientRect
// and getComputedStyle on the board). Expected to fail until the Console shell lands.
const COLORS: Record<Theme, { surface: string; line: string; topbar: string }> = {
  dark: { surface: 'rgb(17, 20, 23)', line: 'rgb(35, 41, 46)', topbar: 'rgba(11, 13, 15, 0.92)' },
  light: { surface: 'rgb(255, 255, 255)', line: 'rgb(225, 228, 231)', topbar: 'rgba(255, 255, 255, 0.92)' },
}

test.describe('geometry at 1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openReader(page)
  })

  test('top bar is 52 high, plus a 2px progress line and a 1px border', async ({ page, theme }) => {
    const header = page.locator(READER_REGIONS.topbar).first()
    await expectBox(header, { x: 0, y: 0, width: 1440, height: 55 })
    await expectBox(header.locator(':scope > :first-child'), { height: 52 })
    await expectComputed(header, {
      position: 'sticky',
      top: '0px',
      'background-color': COLORS[theme].topbar,
      'border-bottom-color': COLORS[theme].line,
    })
  })

  test('outline rows are 236 wide inside a 250 panel at x 16', async ({ page, theme }) => {
    const outline = page.locator(READER_REGIONS.outline)
    await expectBox(outline, { x: 16, y: 71, width: 250 })
    await expectBox(outline.locator('a').first(), { width: 236, height: 32 })
    await expectComputed(outline, {
      position: 'sticky',
      top: '64px',
      'border-radius': '6px',
      'background-color': COLORS[theme].surface,
      'border-top-color': COLORS[theme].line,
    })
  })

  test('dock is 340 wide inside a 342 box at x 1082', async ({ page, theme }) => {
    const dock = page.locator(READER_REGIONS.dock)
    await expectBox(dock, { x: 1082, y: 71, width: 342 })
    await expectBox(dock.locator(':scope > :first-child'), { width: 340 })
    await expectComputed(dock, {
      position: 'sticky',
      top: '64px',
      'background-color': COLORS[theme].surface,
      'border-top-color': COLORS[theme].line,
    })
  })

  test('document column is 784 wide at x 282', async ({ page, theme }) => {
    await expectBox(page.locator('main').first(), { x: 282, width: 784 })
    await expectComputed(page.locator('section#s1'), {
      'border-radius': '6px',
      'background-color': COLORS[theme].surface,
      'border-top-color': COLORS[theme].line,
    })
  })
})
