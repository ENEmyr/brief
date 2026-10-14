import { test, type Browser, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { FAVICON_SIZES, renderIcon } from './lib/favicon'
import { BOARD_FONTS, assertFontsLoaded } from './lib/fonts'
import {
  BOARDS_DIR,
  GENERATED_DIR,
  LIGHTIFY,
  REFERENCE_DIR,
  boardWidth,
  rowBBoards,
  serveBoards,
} from './lib/handoff'
import {
  BOARD_FOR_THEME,
  LANDING_REGIONS,
  LANDING_WIDTHS,
  PHONE_SCREEN,
  READER_REGIONS,
  READER_WIDTHS,
  THEMES,
  clipOf,
  clipOfRegion,
  snapToPixelRow,
  type Clip,
} from './lib/regions'

/**
 * Reference renderer. Renders the row B boards from the handoff folder in
 * Playwright's own Chromium at DPR 1, after the fonts loaded, and writes PNGs
 * to e2e/visual/reference/. `bun run e2e:visual:refs`.
 */

interface Crop {
  name: string
  board: string
  selector: string
  nth?: number
  hasText?: string
  hasNotText?: string
  /** Text the element must contain (case-insensitive); guards against the board changing under the map. */
  contains?: string
  /** Snap the element to a whole pixel row first (snapToPixelRow); the spec must snap the app side too. */
  snap?: boolean
}

const crops = (
  JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'crops.json'), 'utf8')) as { crops: Crop[] }
).crops

let boards: Awaited<ReturnType<typeof serveBoards>>
const written: string[] = []

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  if (!fs.existsSync(path.join(BOARDS_DIR, 'support.js'))) {
    throw new Error(`No boards at ${BOARDS_DIR}. Set BRIEF_HANDOFF_DIR to the console handoff folder.`)
  }
  fs.mkdirSync(GENERATED_DIR, { recursive: true })
  boards = await serveBoards()
})

test.afterAll(async () => {
  await boards.close()
  console.log(`wrote ${written.length} references to ${REFERENCE_DIR}`)
})

/** Opens a board at a width and waits until every font it uses is loaded. Throws on fallback fonts. */
async function openBoard(page: Page, board: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(`${boards.url}/${board}.dc.html`, { waitUntil: 'networkidle' })
  await assertFontsLoaded(page, BOARD_FONTS, board)
  await page.waitForTimeout(400)
}

/** Full-page screenshot, or the clip (page coordinates) cut out of it. */
async function save(page: Page, name: string, clip?: Clip) {
  const file = path.join(REFERENCE_DIR, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true, clip, animations: 'disabled' })
  written.push(file)
}

/**
 * The user agent next/font/google downloads with, read from the installed Next.
 * Google Fonts serves different files per user agent (different advance
 * widths, so Thai lines wrap differently), and the app ships the files Next
 * downloaded, so the boards must get the same ones.
 */
function nextFontUserAgent(): string {
  const file = createRequire(path.resolve(import.meta.dirname, '../../apps/web/package.json')).resolve(
    'next/dist/compiled/@next/font/dist/google/fetch-resource.js',
  )
  const header = /'User-Agent':\s*((?:'[^']*'\s*\+?\s*)+)/.exec(fs.readFileSync(file, 'utf8'))?.[1]
  if (header === undefined) {
    throw new Error(`No User-Agent header in ${file}; next/font changed how it downloads fonts, update nextFontUserAgent()`)
  }
  return [...header.matchAll(/'([^']*)'/g)].map((m) => m[1]).join('')
}

const NEXT_FONT_UA = nextFontUserAgent()

async function newPage(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage()
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
    route.continue({ headers: { ...route.request().headers(), 'user-agent': NEXT_FONT_UA } }),
  )
  return page
}

test('every row B board in full', async ({ browser }) => {
  const page = await newPage(browser)
  for (const board of rowBBoards()) {
    await openBoard(page, board, boardWidth(board))
    await save(page, `board-${board}`)
  }
})

test('reader at 1440, 1100 and 880, dark and light, plus regions', async ({ browser }) => {
  const page = await newPage(browser)
  for (const theme of THEMES) {
    const board = BOARD_FOR_THEME[theme].reader
    for (const width of READER_WIDTHS) {
      await openBoard(page, board, width)
      await save(page, `reader-${theme}-${width}`)
      if (theme === 'dark' && width === 1440) {
        for (const [region, selector] of Object.entries(READER_REGIONS)) {
          await save(page, `region-${theme}-${region}`, await clipOf(page.locator(selector).first()))
        }
      }
    }
  }
})

test('phone screens of B-Mobile and B-Mobile-Light', async ({ browser }) => {
  const page = await newPage(browser)
  for (const theme of THEMES) {
    await openBoard(page, BOARD_FOR_THEME[theme].mobile, 900)
    const frames = await page.evaluate(() =>
      [...document.querySelectorAll('div')]
        .filter((el) => {
          const cs = getComputedStyle(el)
          return cs.borderTopLeftRadius === '36px' && cs.overflow === 'hidden'
        })
        .map((el) => {
          const r = el.getBoundingClientRect()
          const buttons = [...el.querySelectorAll('button')].map((b) => {
            const br = b.getBoundingClientRect()
            return { text: b.innerText, top: br.top - r.top, bottom: br.bottom - r.top }
          })
          return { x: r.x, y: r.y, width: r.width, height: r.height, buttons }
        }),
    )
    if (frames.length !== 2) throw new Error(`expected 2 phone frames on ${theme} mobile board, found ${frames.length}`)
    const cropBottom = PHONE_SCREEN.y + PHONE_SCREEN.height
    for (const [i, name] of ['reading', 'sheet'].entries()) {
      const f = frames[i]!
      if (f.width !== 390 || f.height !== 844) throw new Error(`phone frame is ${f.width}x${f.height}, expected 390x844`)
      const cut = f.buttons.find((b) => b.top < cropBottom && b.bottom > cropBottom)
      if (cut) {
        throw new Error(
          `mobile-${theme}-${name}: button "${cut.text}" spans frame-y ${cut.top}..${cut.bottom}, across the crop's bottom edge at ${cropBottom}; fix PHONE_SCREEN`,
        )
      }
      await save(page, `mobile-${theme}-${name}`, {
        x: f.x + PHONE_SCREEN.x,
        y: f.y + PHONE_SCREEN.y,
        width: PHONE_SCREEN.width,
        height: PHONE_SCREEN.height,
      })
    }
  }
})

test('landing dark and light, regions at 1440 and 390, print', async ({ browser }) => {
  const page = await newPage(browser)
  const light = path.join(GENERATED_DIR, 'B-Landing-Light.dc.html')
  execFileSync('python3', ['-I', LIGHTIFY, path.join(BOARDS_DIR, 'B-Landing.dc.html'), light, 'Landing light'], {
    stdio: 'inherit',
  })
  for (const [theme, board] of [
    ['dark', 'B-Landing'],
    ['light', 'B-Landing-Light'],
  ] as const) {
    await openBoard(page, board, boardWidth('B-Landing'))
    await save(page, `landing-${theme}`)
    for (const width of LANDING_WIDTHS) {
      await openBoard(page, board, width)
      for (const [name, region] of Object.entries(LANDING_REGIONS)) {
        await save(page, `landing-${theme}-${width}-${name}`, await clipOfRegion(page, region))
      }
    }
  }

  await openBoard(page, 'B-Print', boardWidth('B-Print'))
  await save(page, 'print')
})

test('favicon sizes from icon.svg', async ({ browser }) => {
  const page = await newPage(browser)
  for (const size of FAVICON_SIZES) {
    const file = path.join(REFERENCE_DIR, `favicon-${size}.png`)
    fs.writeFileSync(file, await renderIcon(page, size))
    written.push(file)
  }
})

test('element crops from crops.json', async ({ browser }) => {
  const page = await newPage(browser)
  let open = ''
  for (const crop of crops) {
    if (open !== crop.board) {
      await openBoard(page, crop.board, boardWidth(crop.board))
      open = crop.board
    }
    let locator = page.locator(crop.selector, {
      hasText: crop.hasText,
      hasNotText: crop.hasNotText,
    })
    locator = locator.nth(crop.nth ?? 0)
    if (crop.contains !== undefined) {
      const text = (await locator.innerText()).toLowerCase()
      if (!text.includes(crop.contains.toLowerCase())) {
        throw new Error(`crop ${crop.name}: element does not contain "${crop.contains}"; fix its entry in crops.json`)
      }
    }
    if (crop.snap) await snapToPixelRow(locator)
    await save(page, `crop-${crop.name}`, await clipOf(locator))
  }
})

