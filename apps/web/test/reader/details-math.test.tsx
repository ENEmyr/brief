import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { Block } from '@brief/schema'
import { BlockRenderer } from '@/features/reader'
import { ReaderStateProvider } from '@/features/reader-state'
import { DIAGRAM_BLOCK_TYPES } from '@/features/reader/lib/views'

vi.mock('katex', () => ({ renderToString: () => '<span class="katex">tokens</span>' }))

const details = (blocks: Extract<Block, { type: 'details' }>['blocks']): Block => ({ type: 'details', summary: 'how', blocks })

describe('a formula inside a details block (B-Blocks:164-170)', () => {
  it('is the bare formula box under the details header, which names both kinds', async () => {
    const { container } = render(<BlockRenderer block={details([{ type: 'math', latex: 'x' }])} sid={0} bid={0} />)
    await waitFor(() => expect(container.querySelector('[data-math] .katex')).not.toBeNull())

    expect(container.querySelectorAll('figure')).toHaveLength(1)
    const header = container.querySelector('figure > div')!
    expect([...header.querySelectorAll('[data-kind-tag], [data-kind-also]')].map((el) => el.textContent)).toEqual(['details', 'math'])
    expect(container.querySelectorAll('[data-kind-tag]')).toHaveLength(1)
    const box = container.querySelector('[data-math]')!.parentElement!
    expect(box).toHaveClass('rounded-[4px]', 'border', 'border-line', 'bg-page')
  })

  it('keeps its card when it has a title, so the title is not lost', async () => {
    const { container } = render(
      <ReaderStateProvider sessionId="details-math">
        <BlockRenderer block={details([{ type: 'math', latex: 'x', title: 'Refill' }])} sid={0} bid={0} />
      </ReaderStateProvider>,
    )
    await waitFor(() => expect(container.querySelector('[data-math] .katex')).not.toBeNull())

    expect(container.querySelectorAll('figure')).toHaveLength(2)
    expect(screen.getByText('Refill')).toBeInTheDocument()
  })
})

describe('the Diagrams view (d055)', () => {
  it('keeps the blocks that open in the diagram viewer, and not the code-reading blocks', () => {
    for (const type of ['seq', 'state', 'layers', 'erd', 'mermaid', 'bigo', 'heatmap', 'histogram', 'scatter', 'plot3d'] as const) {
      expect(DIAGRAM_BLOCK_TYPES.has(type)).toBe(true)
    }
    for (const type of ['walkthrough', 'diff', 'trajectory', 'ba', 'math'] as const) {
      expect(DIAGRAM_BLOCK_TYPES.has(type)).toBe(false)
    }
  })
})
