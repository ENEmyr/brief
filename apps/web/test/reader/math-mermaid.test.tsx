import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { Block } from '@brief/schema'
import { MathBlock } from '@/features/reader/components/blocks/MathBlock'
import { MermaidBlock } from '@/features/reader/components/blocks/MermaidBlock'
import { BlockRenderer } from '@/features/reader'

const { renderToStringMock } = vi.hoisted(() => ({ renderToStringMock: vi.fn() }))
vi.mock('katex', () => ({ renderToString: renderToStringMock }))

const { mermaidRenderMock, mermaidInitializeMock } = vi.hoisted(() => ({
  mermaidRenderMock: vi.fn(),
  mermaidInitializeMock: vi.fn(),
}))
vi.mock('mermaid', () => ({
  default: { initialize: mermaidInitializeMock, render: mermaidRenderMock },
}))

const { useThemeMock } = vi.hoisted(() => ({ useThemeMock: vi.fn() }))
vi.mock('@/features/theme', () => ({ useTheme: useThemeMock }))

const mathBlock: Extract<Block, { type: 'math' }> = { type: 'math', latex: 'e=mc^2' }
const mermaidBlock: Extract<Block, { type: 'mermaid' }> = { type: 'mermaid', code: 'graph TD; A-->B' }

function pending<T>() {
  return new Promise<T>(() => {
    // never resolves — used to freeze a component in its loading state
  })
}

beforeEach(() => {
  renderToStringMock.mockReset()
  mermaidRenderMock.mockReset()
  mermaidInitializeMock.mockReset()
  useThemeMock.mockReset()
  useThemeMock.mockReturnValue({ theme: 'latte', toggle: vi.fn() })
})

describe('MathBlock', () => {
  it('renders the raw latex in a plain pre immediately, before katex resolves', () => {
    renderToStringMock.mockReturnValue('<span>MATH</span>')

    render(<MathBlock block={mathBlock} />)

    expect(screen.getByText('e=mc^2')).toBeInTheDocument()
  })

  it('defaults the caption to "Equation", or uses the block title', () => {
    renderToStringMock.mockReturnValue('<span>x</span>')

    const { rerender } = render(<MathBlock block={mathBlock} />)
    expect(screen.getByText('Equation')).toBeInTheDocument()

    rerender(<MathBlock block={{ ...mathBlock, title: 'Euler identity' }} />)
    expect(screen.getByText('Euler identity')).toBeInTheDocument()
  })

  it('swaps in the katex-rendered html, marked as the expand root, once the import resolves', async () => {
    renderToStringMock.mockReturnValue('<span class="katex-html">RENDERED_MATH</span>')

    const { container } = render(<MathBlock block={mathBlock} />)

    await waitFor(() => expect(screen.getByText('RENDERED_MATH')).toBeInTheDocument())
    expect(container.querySelector('[data-expand-root]')).toBeInTheDocument()
    expect(renderToStringMock).toHaveBeenCalledWith('e=mc^2', {
      throwOnError: false,
      displayMode: true,
      output: 'html',
    })
  })

  it('does not show the Expand button while katex has not resolved yet, and shows it once rendered', async () => {
    renderToStringMock.mockReturnValue('<span class="katex-html">RENDERED_MATH</span>')

    render(<MathBlock block={mathBlock} />)

    expect(screen.queryByLabelText('Expand diagram')).not.toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('RENDERED_MATH')).toBeInTheDocument())
    expect(screen.getByLabelText('Expand diagram')).toBeInTheDocument()
  })
})

describe('MermaidBlock', () => {
  it('renders the raw code in a plain pre immediately, before mermaid resolves', () => {
    mermaidRenderMock.mockReturnValue(pending())

    render(<MermaidBlock block={mermaidBlock} />)

    expect(screen.getByText('graph TD; A-->B')).toBeInTheDocument()
  })

  it('defaults the caption to "Diagram", or uses the block title', () => {
    mermaidRenderMock.mockReturnValue(pending())

    const { rerender } = render(<MermaidBlock block={mermaidBlock} />)
    expect(screen.getByText('Diagram')).toBeInTheDocument()

    rerender(<MermaidBlock block={{ ...mermaidBlock, title: 'Login flow' }} />)
    expect(screen.getByText('Login flow')).toBeInTheDocument()
  })

  it('swaps in the rendered svg once mermaid resolves', async () => {
    mermaidRenderMock.mockResolvedValue({ svg: '<svg><text>DIAGRAM</text></svg>' })

    render(<MermaidBlock block={mermaidBlock} />)

    await waitFor(() => expect(screen.getByText('DIAGRAM')).toBeInTheDocument())
  })

  it('does not show the Expand button while mermaid has not resolved yet, and shows it once rendered', async () => {
    mermaidRenderMock.mockResolvedValue({ svg: '<svg><text>DIAGRAM</text></svg>' })

    render(<MermaidBlock block={mermaidBlock} />)

    expect(screen.queryByLabelText('Expand diagram')).not.toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('DIAGRAM')).toBeInTheDocument())
    expect(screen.getByLabelText('Expand diagram')).toBeInTheDocument()
  })

  it('falls back to the source in a plain pre with a warning note when mermaid rejects, and never throws', async () => {
    mermaidRenderMock.mockRejectedValue(new Error('parse error'))
    document.body.innerHTML = '<div id="dmm-test-orphan"></div>'

    expect(() => render(<MermaidBlock block={mermaidBlock} />)).not.toThrow()

    await waitFor(() => expect(screen.getByText('Diagram source could not be rendered')).toBeInTheDocument())
    expect(screen.getByText('graph TD; A-->B')).toBeInTheDocument()
  })

  it('initializes mermaid with htmlLabels false at BOTH the top level and flowchart scope', async () => {
    // mermaid 11 ignores flowchart.htmlLabels alone — labels stay
    // foreignObject HTML and DOMPurify's svg profile strips them to empty
    // node boxes. The top-level key is what actually switches labels to
    // pure SVG text; this pins the full config shape so neither key can be
    // dropped without a test failure.
    mermaidRenderMock.mockResolvedValue({ svg: '<svg></svg>' })

    render(<MermaidBlock block={mermaidBlock} />)
    await waitFor(() => expect(mermaidInitializeMock).toHaveBeenCalledTimes(1))

    const config = mermaidInitializeMock.mock.calls.at(0)?.[0]
    expect(config).toMatchObject({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      htmlLabels: false,
      flowchart: { htmlLabels: false },
    })
  })

  it('re-initializes mermaid with different themeVariables when the app theme changes', async () => {
    mermaidRenderMock.mockResolvedValue({ svg: '<svg></svg>' })
    useThemeMock.mockReturnValue({ theme: 'latte', toggle: vi.fn() })

    const { rerender } = render(<MermaidBlock block={mermaidBlock} />)
    await waitFor(() => expect(mermaidInitializeMock).toHaveBeenCalledTimes(1))

    useThemeMock.mockReturnValue({ theme: 'mocha', toggle: vi.fn() })
    rerender(<MermaidBlock block={mermaidBlock} />)
    await waitFor(() => expect(mermaidInitializeMock).toHaveBeenCalledTimes(2))

    const firstCallConfig = mermaidInitializeMock.mock.calls.at(0)?.[0]
    const secondCallConfig = mermaidInitializeMock.mock.calls.at(1)?.[0]
    expect(firstCallConfig?.themeVariables).not.toEqual(secondCallConfig?.themeVariables)
  })

  it('passes a DIFFERENT render id to each mermaid.render invocation (no same-id race across re-renders)', async () => {
    mermaidRenderMock.mockResolvedValue({ svg: '<svg></svg>' })
    useThemeMock.mockReturnValue({ theme: 'latte', toggle: vi.fn() })

    const { rerender } = render(<MermaidBlock block={mermaidBlock} />)
    await waitFor(() => expect(mermaidRenderMock).toHaveBeenCalledTimes(1))

    useThemeMock.mockReturnValue({ theme: 'mocha', toggle: vi.fn() })
    rerender(<MermaidBlock block={mermaidBlock} />)
    await waitFor(() => expect(mermaidRenderMock).toHaveBeenCalledTimes(2))

    const firstId = mermaidRenderMock.mock.calls.at(0)?.[0]
    const secondId = mermaidRenderMock.mock.calls.at(1)?.[0]
    expect(typeof firstId).toBe('string')
    expect(firstId).not.toBe(secondId)
    // Both ids must still be valid CSS ids (useId colons stripped).
    expect(firstId).toMatch(/^mm-[a-zA-Z0-9-]+$/)
    expect(secondId).toMatch(/^mm-[a-zA-Z0-9-]+$/)
  })
})

describe('BlockRenderer routing (next/dynamic, ssr:false)', () => {
  it('eventually routes a math block to the katex-rendered content', async () => {
    renderToStringMock.mockReturnValue('<span>ROUTED_MATH</span>')

    render(<BlockRenderer block={mathBlock} />)

    await waitFor(() => expect(screen.getByText('ROUTED_MATH')).toBeInTheDocument())
  })

  it('eventually routes a mermaid block to the rendered svg', async () => {
    mermaidRenderMock.mockResolvedValue({ svg: '<svg><text>ROUTED_DIAGRAM</text></svg>' })

    render(<BlockRenderer block={mermaidBlock} />)

    await waitFor(() => expect(screen.getByText('ROUTED_DIAGRAM')).toBeInTheDocument())
  })
})
