import { test, type Browser, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
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
  PHONE_SCREEN,
  READER_REGIONS,
  READER_WIDTHS,
  THEMES,
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

const FAMILIES = ['Geist', 'Geist Mono'] as const

/** Opens a board at a width and waits until every font it uses is loaded. Throws on fallback fonts. */
async function openBoard(page: Page, board: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(`${boards.url}/${board}.dc.html`, { waitUntil: 'networkidle' })
  // document.fonts.ready also resolves when a font failed, so inspect the faces.
  const faces = await page.evaluate(async () => {
    await document.fonts.ready
    return [...document.fonts].map((f) => ({ family: f.family.replace(/"/g, ''), status: f.status }))
  })
  const failed = faces.filter((f) => f.status === 'error')
  if (failed.length > 0) throw new Error(`${board}: fonts failed to load: ${JSON.stringify(failed)}`)
  for (const family of FAMILIES) {
    if (!faces.some((f) => f.family === family && f.status === 'loaded')) {
      throw new Error(`${board}: ${family} is not loaded (network blocked?); refusing to write fallback-font references`)
    }
  }
  await page.waitForTimeout(400)
}

async function save(page: Page, name: string, clip?: { x: number; y: number; width: number; height: number }) {
  const file = path.join(REFERENCE_DIR, `${name}.png`)
  await page.screenshot({ path: file, fullPage: clip === undefined, clip, animations: 'disabled' })
  written.push(file)
}

async function newPage(browser: Browser): Promise<Page> {
  return (await browser.newContext({ deviceScaleFactor: 1 })).newPage()
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
          const file = path.join(REFERENCE_DIR, `region-${theme}-${region}.png`)
          await page.locator(selector).first().screenshot({ path: file, animations: 'disabled' })
          written.push(file)
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
          return { x: r.x, y: r.y, width: r.width, height: r.height }
        }),
    )
    if (frames.length !== 2) throw new Error(`expected 2 phone frames on ${theme} mobile board, found ${frames.length}`)
    for (const [i, name] of ['reading', 'sheet'].entries()) {
      const f = frames[i]!
      if (f.width !== 390 || f.height !== 844) throw new Error(`phone frame is ${f.width}x${f.height}, expected 390x844`)
      await save(page, `mobile-${theme}-${name}`, {
        x: f.x + PHONE_SCREEN.x,
        y: f.y + PHONE_SCREEN.y,
        width: PHONE_SCREEN.width,
        height: PHONE_SCREEN.height,
      })
    }
  }
})

test('landing dark and light, print', async ({ browser }) => {
  const page = await newPage(browser)
  await openBoard(page, 'B-Landing', boardWidth('B-Landing'))
  await save(page, 'landing-dark')

  const light = path.join(GENERATED_DIR, 'B-Landing-Light.dc.html')
  execFileSync('python3', ['-I', LIGHTIFY, path.join(BOARDS_DIR, 'B-Landing.dc.html'), light, 'Landing light'], {
    stdio: 'inherit',
  })
  await openBoard(page, 'B-Landing-Light', boardWidth('B-Landing'))
  await save(page, 'landing-light')

  await openBoard(page, 'B-Print', boardWidth('B-Print'))
  await save(page, 'print')
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
    const file = path.join(REFERENCE_DIR, `crop-${crop.name}.png`)
    await locator.screenshot({ path: file, animations: 'disabled' })
    written.push(file)
  }
})

