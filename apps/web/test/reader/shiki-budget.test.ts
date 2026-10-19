import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import type { Element, ElementContent } from 'hast'
import { createCssVariablesTheme, createHighlighter } from 'shiki'
import { highlightToHast } from '@/features/reader/services/shiki'
import { extractLineNodes } from '@/features/reader/components/blocks/codeLines'

// The longest stretch the main thread stays busy while `run` is pending: a 0 ms interval
// timer only fires when the thread is free, so the biggest gap between its ticks (and the
// gaps to the start and end) is the longest freeze a reader would feel.
async function longestFreezeMs(run: () => Promise<unknown>): Promise<number> {
  let last = performance.now()
  let longest = 0
  const tick = () => {
    const now = performance.now()
    longest = Math.max(longest, now - last)
    last = now
  }
  const timer = setInterval(tick, 0)
  await run()
  tick()
  clearInterval(timer)
  return longest
}

const LIMIT_MS = 200

describe('highlightToHast on pathological input', () => {
  it('renders a 20,000 character line of [ as plain text without freezing', async () => {
    await highlightToHast('[x]', 'markdown')
    const code = '['.repeat(20_000)
    let lines: Element[] = []
    const freeze = await longestFreezeMs(async () => {
      lines = extractLineNodes(await highlightToHast(code, 'markdown'))
    })
    expect(freeze).toBeLessThan(LIMIT_MS)
    expect(lines).toHaveLength(1)
    // The cap path: one uncoloured span holding the whole line, so copy and layout keep it.
    const spans = lines[0]!.children as Element[]
    expect(spans).toHaveLength(1)
    expect(spans[0]!.properties.style).toBeUndefined()
    expect(spans[0]!.children).toEqual([{ type: 'text', value: code }])
  })

  it('highlights 2,000 lines of 10 [ without freezing', async () => {
    await highlightToHast('[x]', 'markdown')
    const code = Array.from({ length: 2000 }, () => '['.repeat(10)).join('\n')
    let count = 0
    const freeze = await longestFreezeMs(async () => {
      count = extractLineNodes(await highlightToHast(code, 'markdown')).length
    })
    expect(freeze).toBeLessThan(LIMIT_MS)
    expect(count).toBe(2000)
  })

  it('yields between lines on a block of many long lines under the line cap', async () => {
    await highlightToHast('echo x', 'bash')
    // About 0.6 s of tokenizing in one pass on a fast machine.
    const code = Array.from({ length: 16 }, () => '-'.repeat(999)).join('\n')
    const freeze = await longestFreezeMs(() => highlightToHast(code, 'bash'))
    expect(freeze).toBeLessThan(LIMIT_MS)
  })

  it('highlights 6 bash lines of 1,999 - without freezing', async () => {
    await highlightToHast('echo x', 'bash')
    // About 140 ms per line in one pass on a fast machine.
    const code = Array.from({ length: 6 }, () => '-'.repeat(1999)).join('\n')
    const freeze = await longestFreezeMs(() => highlightToHast(code, 'bash'))
    expect(freeze).toBeLessThan(LIMIT_MS)
  })
})

describe('highlightToHast on real code', () => {
  it('gives a 20,000 character file the same tree as one shiki pass', async () => {
    const code = readFileSync(resolve(process.cwd(), '../../e2e/visual/render-references.ts'), 'utf8')
    expect(code.length).toBeGreaterThan(20_000)
    const shiki = await createHighlighter({
      themes: [createCssVariablesTheme({ name: 'console', variablePrefix: '--shiki-' })],
      langs: ['typescript'],
    })
    const expected = shiki.codeToHast(code, { lang: 'typescript', theme: 'console', tokenizeTimeLimit: 0 })
    const actual = await highlightToHast(code, 'typescript')
    expect(actual).toEqual(expected)
    const coloured = (actual.children[0] as Element).children[0] as Element
    expect(coloured.children.some((line: ElementContent) => line.type === 'element' && line.children.length > 1)).toBe(true)
  })
})
