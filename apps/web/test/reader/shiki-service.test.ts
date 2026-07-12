import { describe, it, expect } from 'vitest'
import type { Element } from 'hast'
import { highlightToHast } from '@/features/reader/services/shiki'
import { classNameOf, extractLineNodes } from '@/features/reader/components/blocks/codeLines'

// Real, unmocked exercise of the lazy shiki singleton — the code-blocks
// component tests mock this module entirely, so this file is what actually
// proves the fallback-to-plaintext path works against the real library.
describe('shiki service', () => {
  it('highlights a known language into a shiki hast tree', async () => {
    const hast = await highlightToHast('const x = 1', 'javascript')
    const pre = hast.children[0] as Element
    expect(pre.tagName).toBe('pre')
    expect(classNameOf(pre)).toContain('shiki')
  })

  it('falls back to plaintext for an unknown/bogus language without throwing', async () => {
    const hast = await highlightToHast('some raw text', 'not-a-real-language-xyz')
    expect(hast.children[0]).toMatchObject({ type: 'element', tagName: 'pre' })
  })

  it('adds the hl-line class to requested 1-based line numbers', async () => {
    const hast = await highlightToHast('a\nb\nc', 'javascript', { highlightLines: [2] })
    const lines = extractLineNodes(hast)
    expect(classNameOf(lines[0]!)).not.toContain('hl-line')
    expect(classNameOf(lines[1]!)).toContain('hl-line')
  })
})
