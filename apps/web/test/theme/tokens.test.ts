import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Tailwind v4 resolves `text-<key>` to a color when `--color-<key>` exists, which
// silently replaces the font-size utility of the same name (`text-base` lost its 16px).
const FONT_SIZE_KEYS = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl']

function themeColorNames(css: string): string[] {
  const start = css.indexOf('@theme')
  const end = css.indexOf('}', start)
  const block = css.slice(css.indexOf('{', start) + 1, end)
  return [...block.matchAll(/--color-([\w-]+)\s*:/g)].map((m) => m[1] as string)
}

describe('theme tokens', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8')

  it('finds the color tokens in @theme', () => {
    expect(themeColorNames(css)).toContain('text')
  })

  it('has no --color-* name equal to a Tailwind font-size key', () => {
    const clashes = themeColorNames(css).filter((name) => FONT_SIZE_KEYS.includes(name))
    expect(clashes).toEqual([])
  })

  it('detects a clashing name', () => {
    expect(themeColorNames('@theme {\n  --color-base: red;\n}')).toEqual(['base'])
  })
})
