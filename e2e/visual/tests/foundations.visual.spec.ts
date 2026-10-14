import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { HANDOFF_DIR } from '../lib/handoff'
import type { Theme } from '../lib/regions'
import { expect, openReader, samplePayload, test } from '../lib/session'

// B-Foundations computed-style checks. Expected values come from the handoff's
// tokens.css (read at run time, never copied into the repo); actual values are
// what the running app resolves. Both sides go through the same probe element,
// so a minifier rewriting `rgba(244, 183, 64, 0.35)` cannot fail the check.

const TOKENS_CSS = fs.readFileSync(path.join(HANDOFF_DIR, 'tokens.css'), 'utf8')
const GLOBALS_CSS = fs.readFileSync(
  path.resolve(import.meta.dirname, '../../../apps/web/src/app/globals.css'),
  'utf8',
)

function block(css: string, selector: RegExp): string {
  const match = css.match(new RegExp(`${selector.source}\\s*\\{([^}]*)\\}`))
  if (!match?.[1]) throw new Error(`no block for ${selector} in tokens.css`)
  return match[1]
}

function declarations(body: string): Array<[string, string]> {
  const plain = body.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...plain.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1] as string, (m[2] as string).trim()])
}

const TOKEN_BLOCKS: Record<Theme, Array<[string, string]>> = {
  light: declarations(block(TOKENS_CSS, /:root,\s*\[data-theme='light'\]/)),
  dark: declarations(block(TOKENS_CSS, /\[data-theme='dark'\]/)),
}
const MOTION = declarations(block(TOKENS_CSS, /\/\* Motion \*\/\s*:root/))

/** The 13 board colors with no light pair in lightify.py (owner ruling D8). Light values are proposals. */
const D8: Array<{ name: string; board: string; dark: string; light: string }> = [
  { name: '--c-table-zebra', board: 'B-Blocks:119', dark: '#0f1215', light: '#f9fafa' },
  { name: '--c-heat-1', board: 'B-Blocks:181', dark: '#23301a', light: '#eef8d9' },
  { name: '--c-heat-2', board: 'B-Blocks:181', dark: '#3b5420', light: '#e0f5af' },
  { name: '--c-heat-3', board: 'B-Blocks:182', dark: '#6e9a2e', light: '#d3f384' },
  { name: '--c-plot3d-2', board: 'B-Blocks2:173', dark: '#56701f', light: '#afd07c' },
  { name: '--c-plot3d-3', board: 'B-Blocks2:174', dark: '#7fa126', light: '#99be5f' },
  { name: '--c-plot3d-4', board: 'B-Blocks2:175', dark: '#a5cb3a', light: '#7ea73a' },
  { name: '--c-plot3d-grid', board: 'B-Blocks2:177', dark: '#2a3330', light: '#cdd2d7' },
  { name: '--c-diff-add-text', board: 'B-NewBlocks:185', dark: '#1f4a35', light: '#a9dcc2' },
  { name: '--c-selection', board: 'B-Overlays:101', dark: '#2e4a0e', light: '#b9d98a' },
  { name: '--c-viewer-canvas', board: 'B-Overlays:146', dark: '#08090a', light: '#eef0f2' },
  { name: '--c-skeleton-mid', board: 'B-States:15', dark: '#1f252a', light: '#eef0f2' },
  { name: '--c-disabled-text', board: 'B-Components:62', dark: '#4b545c', light: '#a1aab2' },
]

/** Computed value of `property` for `value` set on a probe inside <body>, so var() resolves in the page theme. */
async function resolveAll(page: Page, property: string, values: string[]): Promise<string[]> {
  return page.evaluate(
    ({ property, values }) => {
      const probe = document.createElement('div')
      document.body.append(probe)
      const out = values.map((value) => {
        probe.style.setProperty(property, value)
        return getComputedStyle(probe).getPropertyValue(property)
      })
      probe.remove()
      return out
    },
    { property, values },
  )
}

function propertyFor(name: string): string {
  return name.startsWith('--shadow-') ? 'box-shadow' : 'color'
}

test.describe('B-Foundations tokens resolve in the app', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openReader(page)
  })

  test('every tokens.css color and shadow equals the running value', async ({ page, theme }) => {
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme)
    const tokens = TOKEN_BLOCKS[theme]
    expect(tokens.length, 'tokens parsed from tokens.css').toBeGreaterThan(30)
    expect(tokens.map(([name]) => name), 'both theme blocks declare the same names').toEqual(
      TOKEN_BLOCKS[theme === 'dark' ? 'light' : 'dark'].map(([name]) => name),
    )
    for (const property of ['color', 'box-shadow']) {
      const subset = tokens.filter(([name]) => propertyFor(name) === property)
      const actual = await resolveAll(page, property, subset.map(([name]) => `var(${name})`))
      const expected = await resolveAll(page, property, subset.map(([, value]) => value))
      expect(Object.fromEntries(subset.map(([name], i) => [name, actual[i]]))).toEqual(
        Object.fromEntries(subset.map(([name], i) => [name, expected[i]])),
      )
    }
  })

  test('motion durations equal tokens.css', async ({ page }) => {
    const actual = await resolveAll(page, 'transition-duration', MOTION.map(([name]) => `var(${name})`))
    const expected = await resolveAll(page, 'transition-duration', MOTION.map(([, value]) => value))
    expect(MOTION.length).toBe(4)
    expect(actual).toEqual(expected)
  })

  test('the 13 D8 colors exist with the board dark value and the proposed light value', async ({ page, theme }) => {
    const actual = await resolveAll(page, 'color', D8.map((d) => `var(${d.name})`))
    const expected = await resolveAll(page, 'color', D8.map((d) => d[theme]))
    expect(Object.fromEntries(D8.map((d, i) => [`${d.name} (${d.board})`, actual[i]]))).toEqual(
      Object.fromEntries(D8.map((d, i) => [`${d.name} (${d.board})`, expected[i]])),
    )
  })

  test('the body text runs on Geist with Noto Sans Thai behind it, and all three faces load', async ({ page }) => {
    const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
    expect(fontFamily.startsWith('Geist, "Geist Fallback", "Noto Sans Thai"')).toBe(true)
    const loaded = await page.evaluate(() =>
      [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')),
    )
    for (const family of ['Geist', 'Geist Mono', 'Noto Sans Thai']) expect(loaded).toContain(family)
  })
})

test('globals.css @theme is the tokens.css @theme block', () => {
  const theme = (css: string) => block(css, /@theme/).replace(/\s+/g, ' ').trim()
  expect(theme(GLOBALS_CSS)).toBe(theme(TOKENS_CSS))
})

// The diagram label width estimate in svgText.ts, measured against the real
// fonts. Corpus: every Thai string of up to 60 characters in the visual
// fixture (the B-Reader sample brief). Method: render each one as SVG text in
// DIAGRAM_FONT_STACK at 100px, at weight 400 and at 700 (the heaviest weight a
// diagram label uses), and read getComputedTextLength(). After a font change,
// run this spec and set ADVANCE_EM to the printed mean at 400 and WIDTH_SLACK
// so that their product covers the printed max.
interface SvgTextModule {
  DIAGRAM_FONT_STACK: string
  advanceCount: (text: string) => number
  estimateTextWidth: (text: string, fontSize: number) => number
}

const SVG_TEXT_PATH = path.resolve(import.meta.dirname, '../../../apps/web/src/features/reader/lib/svgText.ts')
const FONT_SIZE = 100
const THAI = /[฀-๿]/

function thaiCorpus(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (THAI.test(value) && value.length <= 60) out.add(value)
  } else if (Array.isArray(value)) value.forEach((v) => thaiCorpus(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => thaiCorpus(v, out))
  return out
}

async function measure(page: Page, fontFamily: string, texts: string[], fontWeight: number): Promise<number[]> {
  return page.evaluate(
    async ({ fontFamily, texts, fontSize, fontWeight }) => {
      const ns = 'http://www.w3.org/2000/svg'
      const svg = document.createElementNS(ns, 'svg')
      document.body.append(svg)
      const nodes = texts.map((text) => {
        const node = document.createElementNS(ns, 'text')
        node.setAttribute('font-size', String(fontSize))
        node.setAttribute('font-weight', String(fontWeight))
        node.style.fontFamily = fontFamily
        node.textContent = text
        svg.append(node)
        return node
      })
      nodes.forEach((n) => n.getComputedTextLength())
      await document.fonts.ready
      const widths = nodes.map((n) => n.getComputedTextLength())
      svg.remove()
      return widths
    },
    { fontFamily, texts, fontSize: FONT_SIZE, fontWeight },
  )
}

const WEIGHTS = [400, 700] as const

test.describe('svgText width constants match Geist Mono and Noto Sans Thai', () => {
  test.beforeEach(({ theme }) => {
    test.skip(theme !== 'dark', 'font metrics do not depend on the theme')
  })

  test('latin is exact, Thai never clips and carries little slack', async ({ page }) => {
    const svgText = (await import(SVG_TEXT_PATH)) as SvgTextModule
    await page.setViewportSize({ width: 1440, height: 900 })
    await openReader(page)

    const latin = ['MMMMMMMMMM', 'iiiiiiiiii', '0123456789', 'take(key, 1)']
    const corpus = [...thaiCorpus(samplePayload)]
    expect(corpus.length, 'Thai strings in the fixture').toBeGreaterThan(10)

    const report: Record<string, unknown> = { thaiSamples: corpus.length }
    const all: number[] = []
    for (const weight of WEIGHTS) {
      const latinWidths = await measure(page, svgText.DIAGRAM_FONT_STACK, latin, weight)
      latin.forEach((text, i) => {
        expect(Math.abs(svgText.estimateTextWidth(text, FONT_SIZE) - latinWidths[i]!), `latin "${text}" @${weight}`).toBeLessThan(0.5)
      })
      const widths = await measure(page, svgText.DIAGRAM_FONT_STACK, corpus, weight)
      corpus.forEach((text, i) => {
        expect(svgText.estimateTextWidth(text, FONT_SIZE), `no clip @${weight}: "${text}"`).toBeGreaterThanOrEqual(widths[i]!)
      })
      const ratios = widths.map((w, i) => w / (svgText.advanceCount(corpus[i]!) * FONT_SIZE))
      all.push(...ratios)
      report[`monoAdvanceEm@${weight}`] = latinWidths.map((w, i) => (w / (latin[i]!.length * FONT_SIZE)).toFixed(4))
      report[`thaiMeanAdvanceEm@${weight}`] = (ratios.reduce((a, b) => a + b, 0) / ratios.length).toFixed(4)
      report[`thaiMaxAdvanceEm@${weight}`] = Math.max(...ratios).toFixed(4)
    }
    const max = Math.max(...all)
    report.perCharEstimateEm = svgText.estimateTextWidth('ก', 1).toFixed(4)
    console.log('svgText measurement', JSON.stringify(report))
    test.info().annotations.push({ type: 'svgText measurement', description: JSON.stringify(report) })

    // The tightest estimate that never clips is `max` per character; allow rounding, not slack.
    expect(svgText.estimateTextWidth('ก', 1)).toBeLessThanOrEqual(max * 1.03)
  })
})
