import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MathBlock } from '@/features/reader/components/blocks/MathBlock'

// Real KaTeX, unmocked: B6 (features.md) and B-States:92-98. Bad LaTeX fails
// inside its card with fixed copy, the parser's line number, and the source
// with that line marked; KaTeX's own message (which quotes the source) and
// any stack or path never render.

describe('MathBlock with bad LaTeX', () => {
  it('marks the line the parser stopped on', async () => {
    render(<MathBlock block={{ type: 'math', latex: 'a + b\n\\foo{x}\nc' }} />)

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Math could not be drawn. Parse error on line 2.',
      ),
    )
    expect(document.querySelector('[data-bad-line]')?.textContent).toBe('2  \\foo{x}')
    expect(document.body.textContent).not.toMatch(/KaTeX|Undefined control sequence|position/)
    expect(screen.getByText('math')).toHaveAttribute('data-kind-tag')
  })

  it('points at the last line when the input ends early', async () => {
    render(<MathBlock block={{ type: 'math', latex: '\\frac{a}{' }} />)

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Math could not be drawn. Parse error on line 1.',
      ),
    )
    expect(document.querySelector('[data-bad-line]')?.textContent).toBe('1  \\frac{a}{')
  })

  it('draws good LaTeX with no error', async () => {
    render(<MathBlock block={{ type: 'math', latex: 'e=mc^2' }} />)

    await waitFor(() => expect(document.querySelector('[data-math] .katex')).not.toBeNull())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
