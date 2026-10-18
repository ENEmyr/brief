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
// Token values tagged with the theme they were read for, so a test can see
// which theme MermaidBlock asked for and which token feeds which variable.
vi.mock('@/features/theme', () => ({
  useTheme: useThemeMock,
  beginThemedRender: () => () => {},
  readColorTokens: (theme: string, names: readonly string[]) =>
    Object.fromEntries(names.map((name) => [name, `${theme}:${name}`])),
  readFontStack: (kind: string) => `${kind}-stack`,
}))

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
  useThemeMock.mockReturnValue({ theme: 'light', toggle: vi.fn() })
})

describe('MathBlock', () => {
  it('renders the raw latex in a plain pre immediately, before katex resolves', () => {
    renderToStringMock.mockReturnValue('<span>MATH</span>')

    render(<MathBlock block={mathBlock} />)

    expect(screen.getByText('e=mc^2')).toBeInTheDocument()
  })

  it('shows the math kind tag, and the block title as caption when there is one', () => {
    // The fallback caption 'Equation' is gone: the kind tag names the block
    // (B-Blocks:163), and an untitled block shows no invented caption.
    renderToStringMock.mockReturnValue('<span>x</span>')

    const { rerender } = render(<MathBlock block={mathBlock} />)
    expect(screen.getByText('math')).toHaveAttribute('data-kind-tag')
    expect(screen.queryByText('Equation')).not.toBeInTheDocument()

    rerender(<MathBlock block={{ ...mathBlock, title: 'Euler identity' }} />)
    expect(screen.getByText('Euler identity')).toBeInTheDocument()
  })

  it('swaps in the katex-rendered html in place of the raw latex once the import resolves', async () => {
    // data-expand-root marked what the old Expand pill serialized; math has no
    // full-screen button any more (see below), so the marker went with it.
    renderToStringMock.mockReturnValue('<span class="katex-html">RENDERED_MATH</span>')

    render(<MathBlock block={mathBlock} />)

    await waitFor(() => expect(screen.getByText('RENDERED_MATH')).toBeInTheDocument())
    expect(screen.queryByText('e=mc^2')).not.toBeInTheDocument()
    // throwOnError used to be false, which drew bad LaTeX as red spans in the
    // formula. A failure now shows inside the card with its source (B6).
    expect(renderToStringMock).toHaveBeenCalledWith('e=mc^2', {
      throwOnError: true,
      displayMode: true,
      output: 'html',
    })
  })

  it('shows any other KaTeX failure in the card as fixed copy, with the source and no message', async () => {
    renderToStringMock.mockImplementation(() => {
      throw new TypeError('boom at fn (/home/agent/app/katex.tsx:12:3)')
    })

    render(<MathBlock block={mathBlock} />)

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('This block could not be drawn.'),
    )
    expect(screen.getByText(/e=mc\^2/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/boom|\/home\/|\.tsx/)
  })

  it('has no full-screen button, before or after katex renders', async () => {
    // Math used to get an Expand pill once rendered. B-Blocks draws math with
    // no full-screen button (B-Blocks:163-169), and the full-screen set is diagrams,
    // plot3d, bigo, heatmap, histogram and scatter.
    renderToStringMock.mockReturnValue('<span class="katex-html">RENDERED_MATH</span>')

    render(<MathBlock block={mathBlock} />)

    expect(screen.queryByRole('button', { name: 'Open diagram full screen' })).not.toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('RENDERED_MATH')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Open diagram full screen' })).not.toBeInTheDocument()
  })
})

describe('MermaidBlock', () => {
  it('renders the raw code in a plain pre immediately, before mermaid resolves', () => {
    mermaidRenderMock.mockReturnValue(pending())

    render(<MermaidBlock block={mermaidBlock} />)

    expect(screen.getByText('graph TD; A-->B')).toBeInTheDocument()
  })

  it('shows the mermaid kind tag, and the block title as caption when there is one', () => {
    // The fallback caption 'Diagram' is gone: the kind tag names the block
    // (B-Blocks2:97), and an untitled block shows no invented caption.
    mermaidRenderMock.mockReturnValue(pending())

    const { rerender } = render(<MermaidBlock block={mermaidBlock} />)
    expect(screen.getByText('mermaid')).toHaveAttribute('data-kind-tag')
    expect(screen.queryByText('Diagram')).not.toBeInTheDocument()

    rerender(<MermaidBlock block={{ ...mermaidBlock, title: 'Login flow' }} />)
    expect(screen.getByText('Login flow')).toBeInTheDocument()
  })

  it('swaps in the rendered svg once mermaid resolves', async () => {
    mermaidRenderMock.mockResolvedValue({ svg: '<svg><text>DIAGRAM</text></svg>' })

    render(<MermaidBlock block={mermaidBlock} />)

    await waitFor(() => expect(screen.getByText('DIAGRAM')).toBeInTheDocument())
  })

  it('keeps the full-screen button disabled while mermaid has not resolved yet, and enables it once rendered', async () => {
    // The button used to be absent until the svg arrived. It now shows from
    // the start, disabled, so the header keeps its 45px height (B-Blocks2:97-99)
    // when the diagram arrives; the header says "loading diagram" meanwhile.
    mermaidRenderMock.mockResolvedValue({ svg: '<svg><text>DIAGRAM</text></svg>' })

    render(<MermaidBlock block={mermaidBlock} />)

    expect(screen.getByRole('button', { name: 'Open diagram full screen' })).toBeDisabled()
    expect(screen.getByText('loading diagram')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('DIAGRAM')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Open diagram full screen' })).toBeEnabled()
    expect(screen.queryByText('loading diagram')).not.toBeInTheDocument()
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

  it('feeds the B-Blocks2 themeVariables from the current theme tokens and the sans stack', async () => {
    mermaidRenderMock.mockResolvedValue({ svg: '<svg></svg>' })
    useThemeMock.mockReturnValue({ theme: 'dark', toggle: vi.fn() })

    render(<MermaidBlock block={mermaidBlock} />)
    await waitFor(() => expect(mermaidInitializeMock).toHaveBeenCalledTimes(1))

    expect(mermaidInitializeMock.mock.calls.at(0)?.[0]?.themeVariables).toEqual({
      background: 'dark:card',
      primaryColor: 'dark:elev',
      primaryBorderColor: 'dark:line2',
      primaryTextColor: 'dark:text',
      lineColor: 'dark:sub',
      secondaryColor: 'dark:accent-soft',
      tertiaryColor: 'dark:code-bg',
      fontFamily: 'sans-stack',
      fontSize: '12px',
    })
  })

  it('re-initializes mermaid with different themeVariables when the app theme changes', async () => {
    mermaidRenderMock.mockResolvedValue({ svg: '<svg></svg>' })
    useThemeMock.mockReturnValue({ theme: 'light', toggle: vi.fn() })

    const { rerender } = render(<MermaidBlock block={mermaidBlock} />)
    await waitFor(() => expect(mermaidInitializeMock).toHaveBeenCalledTimes(1))

    useThemeMock.mockReturnValue({ theme: 'dark', toggle: vi.fn() })
    rerender(<MermaidBlock block={mermaidBlock} />)
    await waitFor(() => expect(mermaidInitializeMock).toHaveBeenCalledTimes(2))

    const firstCallConfig = mermaidInitializeMock.mock.calls.at(0)?.[0]
    const secondCallConfig = mermaidInitializeMock.mock.calls.at(1)?.[0]
    expect(firstCallConfig?.themeVariables).not.toEqual(secondCallConfig?.themeVariables)
  })

  it('passes a DIFFERENT render id to each mermaid.render invocation (no same-id race across re-renders)', async () => {
    mermaidRenderMock.mockResolvedValue({ svg: '<svg></svg>' })
    useThemeMock.mockReturnValue({ theme: 'light', toggle: vi.fn() })

    const { rerender } = render(<MermaidBlock block={mermaidBlock} />)
    await waitFor(() => expect(mermaidRenderMock).toHaveBeenCalledTimes(1))

    useThemeMock.mockReturnValue({ theme: 'dark', toggle: vi.fn() })
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
