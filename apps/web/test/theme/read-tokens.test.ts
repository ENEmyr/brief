import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readColorTokens, readFontStack } from '@/features/theme'
import { chartPalette } from '@/features/reader/services/echarts'

/**
 * The light and dark token blocks from globals.css, as the browser sees them
 * on screen. jsdom does not evaluate `@media not print`, so the dark block is
 * injected without that wrapper.
 */
function tokenBlocks(): string {
  const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8')
  const light = css.match(/:root,\s*\[data-theme='light'\]\s*\{[^}]*\}/)?.[0]
  const dark = css.match(/\[data-theme='dark'\]\s*\{[^}]*\}/)?.[0]
  if (!light || !dark) throw new Error('token blocks not found in globals.css')
  return `${light}\n${dark}`
}

describe('readColorTokens', () => {
  const style = document.createElement('style')

  beforeAll(() => {
    style.textContent = tokenBlocks()
    document.head.append(style)
  })

  afterAll(() => {
    style.remove()
    document.documentElement.removeAttribute('style')
  })

  it('reads the light values whatever theme the page is in', () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    expect(readColorTokens('light', ['card', 'accent-text', 'table-zebra'])).toEqual({
      card: '#ffffff',
      'accent-text': '#4d7a00',
      'table-zebra': '#f9fafa',
    })
  })

  it('reads the dark values whatever theme the page is in', () => {
    document.documentElement.setAttribute('data-theme', 'light')
    expect(readColorTokens('dark', ['card', 'accent-text', 'table-zebra'])).toEqual({
      card: '#111417',
      'accent-text': '#c5f05a',
      'table-zebra': '#0f1215',
    })
  })

  it('leaves no probe element behind', () => {
    const before = document.body.childElementCount
    readColorTokens('dark', ['card'])
    expect(document.body.childElementCount).toBe(before)
  })

  it('builds the chart palette from the data hues of the tokens', () => {
    expect(chartPalette('dark')).toMatchObject({
      text: '#e8ecee',
      line2: '#313940',
      card: '#111417',
      accentText: '#c5f05a',
      info: '#62c7f5',
      dataOrange: '#ff9f5a',
      dataTeal: '#3dd6c6',
    })
  })
})

describe('readFontStack', () => {
  afterAll(() => document.documentElement.removeAttribute('style'))

  it('puts the next/font families first and Noto Sans Thai after them', () => {
    document.documentElement.style.setProperty('--font-geist', "'Geist', 'Geist Fallback'")
    document.documentElement.style.setProperty('--font-geist-mono', "'Geist Mono', 'Geist Mono Fallback'")
    document.documentElement.style.setProperty('--font-noto-thai', "'Noto Sans Thai', 'Noto Sans Thai Fallback'")
    expect(readFontStack('mono')).toBe(
      "'Geist Mono', 'Geist Mono Fallback', 'Noto Sans Thai', 'Noto Sans Thai Fallback', ui-monospace, monospace",
    )
    expect(readFontStack('sans')).toBe(
      "'Geist', 'Geist Fallback', 'Noto Sans Thai', 'Noto Sans Thai Fallback', ui-sans-serif, system-ui, sans-serif",
    )
  })
})
