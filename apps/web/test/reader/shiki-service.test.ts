import { describe, it, expect } from 'vitest'
import { highlight } from '@/features/reader/services/shiki'

// Real, unmocked exercise of the lazy shiki singleton — the code-blocks
// component tests mock this module entirely, so this file is what actually
// proves the fallback-to-plaintext path works against the real library.
describe('shiki service', () => {
  it('highlights a known language into shiki markup', async () => {
    const html = await highlight('const x = 1', 'javascript')
    expect(html).toContain('class="shiki')
    expect(html).toContain('<code>')
  })

  it('falls back to plaintext for an unknown/bogus language without throwing', async () => {
    await expect(highlight('some raw text', 'not-a-real-language-xyz')).resolves.toContain('<pre')
  })

  it('adds the hl-line class to requested 1-based line numbers', async () => {
    const html = await highlight('a\nb\nc', 'javascript', { highlightLines: [2] })
    const lines = html.split('\n')
    expect(lines[0]).not.toContain('hl-line')
    expect(lines[1]).toContain('hl-line')
  })
})
