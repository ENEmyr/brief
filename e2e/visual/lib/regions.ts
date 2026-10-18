import type { Locator, Page } from '@playwright/test'

/**
 * Selectors for the B-Reader regions, shared by the reference renderer (run
 * against the board) and the visual specs (run against the app). They are the
 * contract the Console shell has to meet: the same landmarks must exist in the
 * app. Keyed on the board's accessible names, not on the board's own markup.
 */
export const READER_REGIONS = {
  topbar: 'header',
  outline: 'nav[aria-label="Outline"]',
  s1: 'section#s1',
  s2: 'section#s2',
  s3: 'section#s3',
  s4: 'section#s4',
  dock: 'aside[aria-label="Decision dock"]',
} as const

export const READER_WIDTHS = [1440, 1100, 880] as const

export interface Region {
  selector: string
  hasText?: string
  unionOfFirst?: number
}
export const LANDING_REGIONS: Record<string, Region> = {
  header: { selector: 'header' },
  hero: { selector: 'section:has(h1)' },
  'hero-copy': { selector: 'section:has(h1) > div:first-child' },
  how: { selector: 'section#how' },
  usage: { selector: 'section#usage' },
  'usage-tabs': { selector: 'div:has(> [role="tablist"])' },
  preview: { selector: 'section#preview' },
  'preview-body': { selector: '[aria-label="Preview of a brief"] > div:nth-child(3)' },
  blocks: { selector: 'section#blocks' },
  'blocks-rows': { selector: '#blocks tr', unionOfFirst: 5 },
  features: { selector: 'section#features' },
  closing: { selector: 'section', hasText: 'Give your agent a better way to ask.' },
  footer: { selector: 'footer' },
}
export const LANDING_WIDTHS = [1440, 390] as const

export async function clipOfRegion(page: Page, region: Region): Promise<Clip> {
  const matches = page.locator(region.selector, { hasText: region.hasText })
  if (region.unionOfFirst === undefined) return clipOf(matches.first())
  const clips = []
  for (let i = 0; i < region.unionOfFirst; i++) clips.push(await clipOf(matches.nth(i)))
  const x = Math.min(...clips.map((c) => c.x))
  const y = Math.min(...clips.map((c) => c.y))
  const right = Math.max(...clips.map((c) => c.x + c.width))
  const bottom = Math.max(...clips.map((c) => c.y + c.height))
  return { x, y, width: right - x, height: bottom - y }
}
export const THEMES = ['dark', 'light'] as const
export type Theme = (typeof THEMES)[number]

export const BOARD_FOR_THEME: Record<Theme, { reader: string; mobile: string }> = {
  dark: { reader: 'B-Reader', mobile: 'B-Mobile' },
  light: { reader: 'B-Reader-Light', mobile: 'B-Mobile-Light' },
}

export interface Clip {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The element's box in page coordinates at scroll 0, edges rounded to whole
 * pixels. Regions and crops are cut out of a full-page render with it
 * (`fullPage: true, clip`) on both sides: an element screenshot scrolls the
 * element into the 900 px viewport, drops the rows below it and catches sticky
 * elements at their scrolled position.
 */
export async function clipOf(locator: Locator): Promise<Clip> {
  const box = await locator.evaluate(
    (el) => {
      window.scrollTo({ left: 0, top: 0, behavior: 'instant' })
      const r = el.getBoundingClientRect()
      return { left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY }
    },
    undefined,
    { timeout: 5_000 },
  )
  const x = Math.round(box.left)
  const y = Math.round(box.top)
  return { x, y, width: Math.round(box.right) - x, height: Math.round(box.bottom) - y }
}

/**
 * Moves the element (or its table) down by less than a pixel so its top lands
 * on a whole pixel. The renderer and the specs both call it, so the board and
 * the app are cut at the same sub-pixel phase; without it the print answers
 * crop fails.
 */
export async function snapToPixelRow(locator: Locator): Promise<void> {
  await locator.evaluate((el: HTMLElement) => {
    window.scrollTo({ left: 0, top: 0, behavior: 'instant' })
    const top = el.getBoundingClientRect().top
    const target = el.closest('table') ?? el
    target.style.position = 'relative'
    target.style.top = `${Math.ceil(top) - top}px`
  })
}

/**
 * B-Mobile phone frames are 390x844 with a 1px border and radius 36; the app
 * screen starts below a 44 px status bar, so it is 388 wide and 842 - 44 = 798
 * high. The mobile spec runs at that viewport so bottom-anchored elements land
 * where the frame puts them.
 */
export const PHONE_VIEWPORT = { width: 388, height: 798 } as const

/**
 * The compared part of the phone screen, relative to the frame's outer box.
 * It ends at frame-y 813, the bottom of the sheet's buttons ("open dock" on the
 * reading screen, "Copy prompt for agent" on the sheet screen), and leaves out
 * the last 30 rows, where the frame's rounded corners would put backdrop pixels
 * into the reference. The renderer throws if a button crosses that edge.
 */
export const PHONE_SCREEN = { x: 1, y: 45, width: 388, height: 768 } as const

/**
 * R-V4 (decisions.tsv, 2026-10-19): the app keeps its scrim behind the phone
 * sheet, and the B-Mobile boards draw none. Both sides mask the backdrop: the
 * band above the sheet, which starts 106 px down the phone screen
 * (dock.visual.spec.ts openSheet), and the two corners its 14 px top radius
 * leaves open. x and y are the screen's top-left corner in the coordinates the
 * screenshot clip uses: the viewport on the app (fixed), the page on the board.
 */
export async function sheetBackdropMask(
  page: Page,
  x: number,
  y: number,
  position: 'fixed' | 'absolute',
): Promise<Locator> {
  await page.evaluate(
    ({ x, y, position }) => {
      for (const [left, top, width, height] of [
        [0, 0, 388, 106],
        [0, 106, 14, 14],
        [374, 106, 14, 14],
      ]) {
        const mask = document.createElement('div')
        mask.className = 'sheet-backdrop-mask'
        mask.style.cssText = `position:${position};left:${x + left!}px;top:${y + top!}px;width:${width}px;height:${height}px;pointer-events:none`
        document.body.append(mask)
      }
    },
    { x, y, position },
  )
  return page.locator('.sheet-backdrop-mask')
}
