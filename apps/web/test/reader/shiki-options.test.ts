import { describe, it, expect, vi } from 'vitest'

const codeToHast = vi.fn(() => ({ type: 'root', children: [] }))

vi.mock('shiki', () => ({
  createCssVariablesTheme: () => ({ name: 'console' }),
  createHighlighter: async () => ({ codeToHast, loadLanguage: async () => {} }),
}))

describe('highlightToHast', () => {
  it('turns off the shiki per-line tokenize budget so a slow device never leaves a line tail uncolored', async () => {
    const { highlightToHast } = await import('@/features/reader/services/shiki')
    await highlightToHast('const a = 1', 'javascript')
    expect(codeToHast).toHaveBeenCalledWith(
      'const a = 1',
      expect.objectContaining({ lang: 'javascript', tokenizeTimeLimit: 0 }),
    )
  })
})
