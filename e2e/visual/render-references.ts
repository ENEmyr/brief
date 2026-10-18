import { test, type Browser, type Locator, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
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
  DOCK_VISIBLE_HEIGHT,
  LANDING_REGIONS,
  LANDING_WIDTHS,
  PHONE_SCREEN,
  READER_REGIONS,
  READER_WIDTHS,
  SECTION_HEADERS,
  THEMES,
  clipOf,
  clipOfRegion,
  sheetBackdropMask,
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
  /** Rows of the element the board shows, when its frame clips the rest. */
  visibleHeight?: number
  snap?: boolean
  /** Elements masked on both sides; each use cites the ruling that allows it. */
  mask?: string
  /** CSS added to the board before the cut; each use cites the board line it corrects. */
  css?: string
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
  writeLandingBoards()
  writeBlocksBoard()
  writeReaderBoard()
  writeMobileBoards()
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
async function save(page: Page, name: string, clip?: Clip, mask?: Locator[]) {
  const file = path.join(REFERENCE_DIR, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true, clip, mask, animations: 'disabled' })
  written.push(file)
}

/** The app's self-hosted fonts (apps/web/src/app/fonts.css), the same families and weights the boards ask Google for. */
const APP_FONT_DIR = path.resolve(import.meta.dirname, '../../apps/web/src/app')
const FONT_FILE_URL = 'https://fonts.gstatic.com/brief-local/'
const BOARD_FONT_CSS = fs
  .readFileSync(path.join(APP_FONT_DIR, 'fonts.css'), 'utf8')
  .replaceAll('url(./fonts/', `url(${FONT_FILE_URL}`)

/**
 * Serves the boards' Google Fonts requests from the app's own font files, so a
 * render never downloads a font and the boards get the files the app ships.
 * Any other font request is aborted, which assertFontsLoaded reports.
 */
async function newPage(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage()
  await page.route(/^https:\/\/fonts\.googleapis\.com\//, (route) =>
    route.fulfill({ contentType: 'text/css', body: BOARD_FONT_CSS }),
  )
  await page.route(/^https:\/\/fonts\.gstatic\.com\//, (route) => {
    const url = route.request().url()
    if (!url.startsWith(FONT_FILE_URL)) return route.abort()
    return route.fulfill({
      contentType: 'font/woff2',
      headers: { 'access-control-allow-origin': '*' },
      body: fs.readFileSync(path.join(APP_FONT_DIR, 'fonts', path.basename(url))),
    })
  })
  return page
}

/** Replaces text in a generated board; throws when the board no longer has the text, so a patch never goes stale silently. */
function patch(html: string, from: string | RegExp, to: string, why: string): string {
  const out = html.replace(from, to)
  if (out === html) throw new Error(`board patch "${why}" no longer applies; the board changed under it`)
  return out
}

/**
 * Writes B-Landing.dc.html and B-Landing-Light.dc.html into GENERATED_DIR
 * before any board renders, so every render of B-Landing (the full board, the
 * landing pages and regions) reads the same patched copy. The light board is
 * lightified from the patched dark one.
 */
function writeLandingBoards(): void {
  let html = fs.readFileSync(path.join(BOARDS_DIR, 'B-Landing.dc.html'), 'utf8')
  // C2 (vt-a triage): the board runtime drops whitespace-only text between two
  // elements, so the blank line between two spans in a <pre> vanishes. Move it
  // into the span before. Of every B-*.dc.html <pre>, only B-Landing's usage
  // <pre> has such a gap.
  const before = html
  html = html.replace(/<pre\b[\s\S]*?<\/pre>/g, (pre) => pre.replace(/<\/span>(\s*\n\s*)<span/g, '$1</span><span'))
  if (html === before) throw new Error('board patch "C2 pre blank line" no longer applies; the board changed under it')
  // R-V2 (decisions.tsv 2026-10-19; F3): the example session id is 14 characters.
  html = patch(html, /k2p9x4(?!Qm)/g, 'k2p9x4Qm7Zr1Ta', 'R-V2 session id')
  // R-V2 (d056, d057; D7, D9): row 1 lists list and image, and its note says "and images".
  html = patch(html, '>p note warn good<', '>p list note warn good image<', 'R-V2 row 1 types')
  html = patch(html, 'and the three callout tones.', 'the three callout tones, and images.', 'R-V2 row 1 note')
  // The "proposed" tag marks the Agent work row as unshipped (features.md:310);
  // walkthrough, diff and trajectory shipped, so the app draws no tag
  // (recorded difference, pr-body-phase6.md:117).
  html = patch(html, /<span style="[^"]*">proposed<\/span>/, '', 'Agent work proposed tag')
  // R-V2 (d176): under 880 every landing link and button is a 44 px target.
  html = patch(
    html,
    '@media (prefers-reduced-motion',
    '@media (max-width: 880px){header > a,footer a,#blocks h2 + a{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px}button.bl-btn:not([role=tab]){min-height:44px !important}}\n@media (prefers-reduced-motion',
    'R-V2 44 px targets',
  )
  const dark = path.join(GENERATED_DIR, 'B-Landing.dc.html')
  fs.writeFileSync(dark, html)
  const light = path.join(GENERATED_DIR, 'B-Landing-Light.dc.html')
  execFileSync('python3', ['-I', LIGHTIFY, dark, light, 'Landing light'], { stdio: 'inherit' })
  // C3 (vt-a triage): lightify.py reads the tab data prop `sub` as a background
  // and keeps the selected hint lime; the light foreground pair is #4D7A00.
  fs.writeFileSync(
    light,
    patch(fs.readFileSync(light, 'utf8'), "sub: on ? '#C5F05A'", "sub: on ? '#4D7A00'", 'C3 light tab hint'),
  )
}

/**
 * Writes B-Blocks.dc.html into GENERATED_DIR. The board's inline mono stacks
 * are 'Geist Mono', monospace, without the Thai fallback tokens.css gives
 * --font-mono (Geist Mono, then Noto Sans Thai), so Thai in a card header or a
 * stat hint fell back to a system font on the board only.
 */
function writeBlocksBoard(): void {
  let html = fs.readFileSync(path.join(BOARDS_DIR, 'B-Blocks.dc.html'), 'utf8')
  html = patch(html, /'Geist Mono', monospace/g, "'Geist Mono', 'Noto Sans Thai', monospace", 'tokens.css mono stack')
  // R-V3 (d201): the app keeps KaTeX, whose formula line is 25 high; the
  // board's Times italic line is 23, so its formula box is 2 px shorter
  // (B-Blocks:169). The box is masked on both sides; only its height counts.
  html = patch(html, 'font-size: 20px">tokens(t)', 'font-size: 20px; line-height: 25px">tokens(t)', 'R-V3 KaTeX line')
  fs.writeFileSync(path.join(GENERATED_DIR, 'B-Blocks.dc.html'), html)
}

/**
 * Writes B-Reader.dc.html into GENERATED_DIR. C10 (vt-b triage, owner D3:
 * missing fields are [P] work): the payload has no seq emphasis field, so the
 * app draws the Limiter node and the "4 forward" arrow like every other node
 * and arrow. The board's accent on both is dropped and recorded in
 * fixtures/brief-sample.gaps.json (section 02 seq block).
 */
function writeReaderBoard(): void {
  let html = fs.readFileSync(path.join(BOARDS_DIR, 'B-Reader.dc.html'), 'utf8')
  html = patch(
    html,
    'background: #1E2612; border: 1px solid #C5F05A; border-radius: 4px; font-family: \'Geist\', sans-serif; font-size: 13px; font-weight: 500">Limiter<',
    'background: #171B1F; border: 1px solid #313940; border-radius: 4px; font-family: \'Geist\', sans-serif; font-size: 13px; font-weight: 500">Limiter<',
    'C10 Limiter emphasis',
  )
  const arrow = /<svg[^>]*left: 240px; top: 248px[^>]*>[\s\S]*?<\/svg>/.exec(html)?.[0] ?? ''
  html = patch(html, arrow, arrow.replaceAll('#C5F05A', '#A1AAB2'), 'C10 forward arrow')
  html = patch(html, 'color: #C5F05A">4 forward<', 'color: #A1AAB2">4 forward<', 'C10 forward label')
  fs.writeFileSync(path.join(GENERATED_DIR, 'B-Reader.dc.html'), html)
}

/**
 * Writes B-Mobile.dc.html and B-Mobile-Light.dc.html into GENERATED_DIR. D6
 * (STATUS.md: fixed UI labels are English, payload content keeps its
 * language): the boards' Thai UI labels become the app's English ones
 * (components.md:83 for the peek bar). Payload text, Thai on the boards,
 * stays as it is.
 */
function writeMobileBoards(): void {
  for (const board of ['B-Mobile', 'B-Mobile-Light']) {
    let html = fs.readFileSync(path.join(BOARDS_DIR, `${board}.dc.html`), 'utf8')
    html = patch(html, '>2 จาก 4 / ถัดไป D2<', '>2 of 4, next D2<', 'D6 peek count')
    html = patch(html, '>เปิด dock<', '>Open dock<', 'D6 open dock')
    html = patch(html, "['other', 'อื่นๆ พิมพ์เอง']", "['other', 'Other, type your own']", 'D6 other option')
    html = patch(html, '>เหตุผล / บริบทเพิ่มเติม<', '>Reason / extra context<', 'D6 reason label')
    html = patch(html, 'placeholder="ไม่บังคับ"', 'placeholder="optional"', 'D6 reason placeholder')
    fs.writeFileSync(path.join(GENERATED_DIR, `${board}.dc.html`), html)
  }
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
      // R-V1: section headers instead of the full page (lib/regions.ts SECTION_HEADERS).
      for (const [name, selector] of Object.entries(SECTION_HEADERS)) {
        await save(page, `reader-${theme}-${width}-${name}`, await clipOf(page.locator(selector).first()))
      }
      if (theme === 'dark' && width === 1440) {
        for (const [region, selector] of Object.entries(READER_REGIONS)) {
          const clip = await clipOf(page.locator(selector).first())
          if (region === 'dock') clip.height = Math.min(clip.height, DOCK_VISIBLE_HEIGHT)
          await save(page, `region-${theme}-${region}`, clip)
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
      const x = f.x + PHONE_SCREEN.x
      const y = f.y + PHONE_SCREEN.y
      const mask = name === 'sheet' ? [await sheetBackdropMask(page, x, y, 'absolute')] : undefined
      await save(
        page,
        `mobile-${theme}-${name}`,
        { x, y, width: PHONE_SCREEN.width, height: PHONE_SCREEN.height },
        mask,
      )
    }
  }
})

test('landing dark and light, regions at 1440 and 390, print', async ({ browser }) => {
  const page = await newPage(browser)
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
    if (crop.css !== undefined) await page.addStyleTag({ content: crop.css })
    if (crop.snap) await snapToPixelRow(locator)
    const clip = await clipOf(locator)
    if (crop.visibleHeight !== undefined) clip.height = Math.min(clip.height, crop.visibleHeight)
    await save(page, `crop-${crop.name}`, clip, crop.mask === undefined ? undefined : [page.locator(crop.mask)])
  }
})
