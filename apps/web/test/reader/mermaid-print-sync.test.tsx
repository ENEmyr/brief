import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import type { Block } from '@brief/schema'
import { MermaidBlock } from '@/features/reader/components/blocks/MermaidBlock'
import { whenThemedRendersIdle } from '@/features/theme'

const { mermaidRenderMock, mermaidInitializeMock } = vi.hoisted(() => ({
  mermaidRenderMock: vi.fn(),
  mermaidInitializeMock: vi.fn(),
}))
vi.mock('mermaid', () => ({
  default: { initialize: mermaidInitializeMock, render: mermaidRenderMock },
}))

const mermaidBlock: Extract<Block, { type: 'mermaid' }> = { type: 'mermaid', code: 'graph TD; A-->B' }

beforeEach(() => {
  mermaidRenderMock.mockReset()
  mermaidInitializeMock.mockReset()
})

/**
 * Blocker 2 regression, MermaidBlock side: the real `@/features/theme`
 * module (unlike math-mermaid.test.tsx, which stubs it out entirely) so
 * `beginThemedRender`/`whenThemedRendersIdle` are the actual mechanism
 * lib/print.ts waits on, not a mock of it.
 */
describe('MermaidBlock / beginThemedRender wiring (real theme module)', () => {
  it('keeps whenThemedRendersIdle unresolved while mermaid.render is in flight, then resolves once it settles', async () => {
    let resolveRender!: (value: { svg: string }) => void
    mermaidRenderMock.mockReturnValue(new Promise<{ svg: string }>((resolve) => (resolveRender = resolve)))

    render(<MermaidBlock block={mermaidBlock} />)
    await waitFor(() => expect(mermaidRenderMock).toHaveBeenCalled())

    let idle = false
    whenThemedRendersIdle().then(() => {
      idle = true
    })
    await Promise.resolve()
    expect(idle).toBe(false)

    resolveRender({ svg: '<svg></svg>' })
    await waitFor(() => expect(idle).toBe(true))
  })
})
