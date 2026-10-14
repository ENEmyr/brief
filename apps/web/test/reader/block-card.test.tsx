import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { BLOCK_TYPES, type Block } from '@brief/schema'
import { BlockRenderer } from '@/features/reader'
import { ReaderStateProvider } from '@/features/reader-state'
import { BlockCard } from '@/features/reader/components/BlockCard'
import { BlockError } from '@/features/reader/components/BlockError'
import { useDiagramFullScreen } from '@/features/reader/components/fullScreen'
import { DiagramViewerProvider } from '@/features/diagram-viewer'

vi.mock('@/features/theme', () => ({
  useTheme: () => ({ theme: 'light', toggle: vi.fn() }),
  beginThemedRender: () => () => {},
  readColorTokens: (theme: string, names: readonly string[]) =>
    Object.fromEntries(names.map((name) => [name, `${theme}:${name}`])),
  readFontStack: (kind: string) => `${kind}-stack`,
}))
const { chart } = vi.hoisted(() => ({ chart: { ready: true } }))
vi.mock('@/features/reader/services/echarts', async () => {
  const actual = await vi.importActual<typeof import('@/features/reader/services/echarts')>(
    '@/features/reader/services/echarts',
  )
  return {
    ...actual,
    useEChart: () => ({
      containerRef: { current: null },
      chartRef: { current: null },
      ready: chart.ready,
    }),
  }
})
vi.mock('@/features/reader/services/shiki', () => ({
  highlightToHast: () => new Promise(() => {}),
}))
vi.mock('mermaid', () => ({
  default: { initialize: vi.fn(), render: () => new Promise(() => {}) },
}))
vi.mock('katex', () => ({ renderToString: () => '<span>MATH</span>' }))

const FULL_SCREEN = { name: 'Open diagram full screen' }

const SAMPLES: Record<Block['type'], Block> = {
  p: { type: 'p', text: 'plain prose' },
  note: { type: 'note', text: 'a note' },
  warn: { type: 'warn', text: 'a warning' },
  good: { type: 'good', text: 'a win' },
  table: { type: 'table', head: ['name'], rows: [['kv']] },
  compare: {
    type: 'compare',
    left: { title: 'A', items: [{ text: 'fast', ok: true }] },
    right: { title: 'B', items: [{ text: 'slow', ok: false }] },
  },
  stat: { type: 'stat', items: [{ label: 'files', value: '12' }] },
  coverage: { type: 'coverage', items: [{ label: 'auth', status: 'full' }] },
  details: { type: 'details', summary: 'more', blocks: [{ type: 'p', text: 'inner' }] },
  seq: { type: 'seq', actors: ['A', 'B'], steps: [{ from: 'A', to: 'B', label: 'hi' }] },
  state: {
    type: 'state',
    states: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    transitions: [{ from: 'a', to: 'b', label: 'go' }],
    initial: 'a',
  },
  layers: {
    type: 'layers',
    layers: [{ id: 'l', label: 'Edge', nodes: [{ id: 'n', label: 'Worker' }], edges: [] }],
  },
  ba: { type: 'ba', language: 'ts', before: 'a', after: 'b' },
  bigo: { type: 'bigo', series: [{ label: 'scan', curve: 'n' }] },
  code: { type: 'code', language: 'ts', code: 'const a = 1' },
  mermaid: { type: 'mermaid', code: 'graph TD; A-->B' },
  math: { type: 'math', latex: 'e=mc^2' },
  erd: { type: 'erd', tables: [{ name: 't', columns: [{ name: 'id', type: 'int', pk: true }] }] },
  heatmap: { type: 'heatmap', xLabels: ['a'], yLabels: ['x'], values: [[1]] },
  histogram: { type: 'histogram', bins: [{ label: '0-10', count: 1 }] },
  scatter: { type: 'scatter', series: [{ label: 'A', points: [[1, 2]] }] },
  plot3d: { type: 'plot3d', kind: 'scatter3d', points: [[0, 0, 1]] },
}

/** features.md B1 and owner ruling D5: diagrams, plot3d and the four 2D charts. */
const FULL_SCREEN_TYPES = new Set([
  'seq',
  'state',
  'layers',
  'erd',
  'mermaid',
  'plot3d',
  'bigo',
  'heatmap',
  'histogram',
  'scatter',
])

/** plot3d draws, and so offers full screen, only where WebGL exists. */
function pretendWebGL() {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never)
}

beforeEach(() => {
  pretendWebGL()
  chart.ready = true
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderBlock(block: Block) {
  return render(
    <ReaderStateProvider sessionId="block-card-test">
      <BlockRenderer block={block} />
    </ReaderStateProvider>,
  )
}

describe('every block renders inside one card header', () => {
  it('has a sample for every schema block type', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...BLOCK_TYPES].sort())
  })

  it.each(BLOCK_TYPES.filter((t) => t !== 'p'))('%s: one header, tagged with its type', (type) => {
    const { container } = renderBlock(SAMPLES[type])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const tags = Array.from(container.querySelectorAll('[data-kind-tag]')).map((t) => t.textContent)
    expect(tags[0]).toBe(type)
    expect(tags).toHaveLength(1)
  })

  it('p stays bare prose: no card, no tag (no board draws a paragraph in a card)', () => {
    const { container } = renderBlock(SAMPLES.p)
    expect(container.querySelector('figure')).toBeNull()
    expect(container.querySelector('[data-kind-tag]')).toBeNull()
  })

  it.each(BLOCK_TYPES)(
    '%s: full-screen button only on diagrams, plot3d and the 2D charts',
    (type) => {
      renderBlock(SAMPLES[type])
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      const buttons = screen.queryAllByRole('button', FULL_SCREEN)
      expect(buttons).toHaveLength(FULL_SCREEN_TYPES.has(type) ? 1 : 0)
    },
  )

  it('a block nested in details keeps its own card and full-screen button', () => {
    const { container } = renderBlock({
      type: 'details',
      summary: 'more',
      blocks: [SAMPLES.seq] as never,
    })
    const tags = Array.from(container.querySelectorAll('[data-kind-tag]')).map((t) => t.textContent)
    expect(tags).toEqual(['details', 'seq'])
    expect(screen.getByRole('button', FULL_SCREEN)).toBeInTheDocument()
  })

  it('mermaid shows its header with a disabled full-screen button while its chunk loads', () => {
    renderBlock({ type: 'mermaid', code: 'graph TD; A-->B', title: 'Login flow' })
    expect(screen.getByText('mermaid')).toHaveAttribute('data-kind-tag')
    expect(screen.getByText('Login flow')).toBeInTheDocument()
    expect(screen.getByText('loading diagram')).toBeInTheDocument()
    expect(screen.getByRole('button', FULL_SCREEN)).toBeDisabled()
  })

  it('mermaid reserves the same box while its chunk loads as once it has drawn: 200 for LR, 400 otherwise', () => {
    const { container, unmount } = renderBlock({ type: 'mermaid', code: 'flowchart LR\n  A --> B' })
    expect(container.querySelector<HTMLElement>('.sk')?.style.height).toBe('200px')
    expect(screen.getByText('mermaid').nextElementSibling).toHaveTextContent('flowchart LR')
    unmount()
    const td = renderBlock({ type: 'mermaid', code: 'flowchart TD\n  A --> B' })
    expect(td.container.querySelector<HTMLElement>('.sk')?.style.height).toBe('400px')
  })

  it('math shows its header while its chunk loads, with no full-screen button', () => {
    renderBlock(SAMPLES.math)
    expect(screen.getByText('math')).toHaveAttribute('data-kind-tag')
    expect(screen.getByText('loading math')).toBeInTheDocument()
    expect(screen.queryByRole('button', FULL_SCREEN)).not.toBeInTheDocument()
  })
})

describe('BlockCard', () => {
  it('renders the kind tag, the caption and the full-screen button', () => {
    render(
      <BlockCard kind="seq" caption={{ text: 'Login flow', path: 'title' }} fullScreen={() => {}}>
        <svg data-testid="diagram" />
      </BlockCard>,
    )
    expect(screen.getByText('seq')).toHaveAttribute('data-kind-tag')
    expect(screen.getByText('Login flow')).toBeInTheDocument()
    expect(screen.getByRole('button', FULL_SCREEN)).toBeEnabled()
  })

  it('draws a derived count after the title with " / " (B-Blocks:75, B-Blocks2:28)', () => {
    render(<BlockCard kind="seq" caption={{ text: 'Login flow', path: 'title' }} captionSuffix="6 messages" />)
    const caption = screen.getByText('seq').nextElementSibling as HTMLElement
    expect(caption).toHaveTextContent('Login flow / 6 messages')
    expect(caption.className).toContain('flex-1')
    expect(screen.getByText('Login flow')).toBeInTheDocument()
  })

  it('draws a derived count alone and left-aligned when there is no title (B-Reader:126)', () => {
    render(<BlockCard kind="seq" captionSuffix="6 messages" meta={<span>log scale</span>} />)
    const caption = screen.getByText('seq').nextElementSibling as HTMLElement
    expect(caption).toHaveTextContent(/^6 messages$/)
    expect(caption.className).toContain('flex-1')
    expect(caption.nextElementSibling).toHaveTextContent('log scale')
  })

  it('renders no full-screen button and no zoom controls without fullScreen', () => {
    render(
      <BlockCard kind="code">
        <pre data-testid="json">{'{}'}</pre>
      </BlockCard>,
    )
    expect(screen.queryByRole('button', FULL_SCREEN)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zoom in' })).not.toBeInTheDocument()
  })

  it('renders controls in the header, before the full-screen button', () => {
    render(
      <BlockCard kind="seq" controls={<button type="button">Step</button>} fullScreen={() => {}}>
        <svg data-testid="diagram" />
      </BlockCard>,
    )
    const header = screen.getByText('seq').parentElement as HTMLElement
    const names = within(header)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent)
    expect(names).toEqual(['Step', 'Open diagram full screen'])
  })

  it('pads a text-only header 8/12 and a header with buttons 6/6/6/12 (B-Blocks:41, B-Blocks2:28)', () => {
    const { rerender } = render(<BlockCard kind="table" />)
    expect(screen.getByText('table').parentElement?.className).toContain('px-3 py-2')
    rerender(<BlockCard kind="state" fullScreen={() => {}} />)
    expect(screen.getByText('state').parentElement?.className).toContain('py-1.5 pl-3 pr-1.5')
    rerender(<BlockCard kind="table" controls={null} />)
    expect(screen.getByText('table').parentElement?.className).toContain('px-3 py-2')
  })

  it('takes no gestures in the page: the body is not a pan/zoom surface', () => {
    const { container } = render(
      <BlockCard kind="seq" fullScreen={() => {}}>
        <svg data-testid="diagram" />
      </BlockCard>,
    )
    const diagram = screen.getByTestId('diagram')
    fireEvent.wheel(diagram, { deltaY: -100, ctrlKey: true })
    expect(diagram.parentElement?.tagName).toBe('FIGURE')
    expect(container.querySelector('[style*="transform"]')).toBeNull()
  })

  it('shows the loading label, and a pending full-screen button disabled', () => {
    render(
      <BlockCard
        kind="scatter"
        fullScreen="pending"
        state={{ status: 'loading', label: 'loading chart' }}
      />,
    )
    expect(screen.getByText('loading chart')).toBeInTheDocument()
    expect(screen.getByRole('button', FULL_SCREEN)).toBeDisabled()
  })

  it.each(['bigo', 'heatmap', 'histogram', 'scatter', 'plot3d'] as const)(
    '%s: "loading chart" and a disabled full-screen button until echarts has drawn (B-States lazy block)',
    (type) => {
      chart.ready = false
      const { rerender } = renderBlock(SAMPLES[type])
      expect(screen.getByText('loading chart')).toBeInTheDocument()
      expect(screen.getByRole('button', FULL_SCREEN)).toBeDisabled()

      chart.ready = true
      rerender(
        <ReaderStateProvider sessionId="block-card-test">
          <BlockRenderer block={{ ...SAMPLES[type] }} />
        </ReaderStateProvider>,
      )
      expect(screen.queryByText('loading chart')).not.toBeInTheDocument()
      expect(screen.getByRole('button', FULL_SCREEN)).toBeEnabled()
    },
  )

  it('in the error state replaces the body and drops controls and full screen (B-States render error)', () => {
    render(
      <BlockCard
        kind="mermaid"
        controls={<button type="button">source</button>}
        fullScreen={() => {}}
        state={{ status: 'error', message: 'Diagram could not be drawn. Parse error on line 3.' }}
      >
        <p>body</p>
      </BlockCard>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Diagram could not be drawn. Parse error on line 3.',
    )
    expect(screen.queryByText('body')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

function FullScreenDiagram({ children }: { children: React.ReactNode }) {
  const diagram = <svg data-testid="diagram" viewBox="0 0 10 10" />
  const onFullScreen = useDiagramFullScreen(diagram)
  return (
    <BlockCard kind="seq" fullScreen={onFullScreen}>
      {diagram}
      {children}
    </BlockCard>
  )
}

describe('useDiagramFullScreen', () => {
  it('opens the live diagram node in the viewer from the full-screen button', () => {
    render(
      <DiagramViewerProvider>
        <FullScreenDiagram>{null}</FullScreenDiagram>
      </DiagramViewerProvider>,
    )
    fireEvent.click(screen.getByRole('button', FULL_SCREEN))
    const dialog = screen.getByRole('dialog', { name: 'Diagram viewer' })
    expect(within(dialog).getByTestId('diagram')).toHaveAttribute('viewBox', '0 0 10 10')
  })

  it('does NOT open when the diagram body is clicked', () => {
    render(
      <DiagramViewerProvider>
        <FullScreenDiagram>{null}</FullScreenDiagram>
      </DiagramViewerProvider>,
    )
    fireEvent.click(screen.getByTestId('diagram'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not open when clicking a button inside the body', () => {
    render(
      <DiagramViewerProvider>
        <FullScreenDiagram>
          <button type="button">Play</button>
        </FullScreenDiagram>
      </DiagramViewerProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('works without a DiagramViewerProvider and does not crash on click (no-op open)', () => {
    render(<FullScreenDiagram>{null}</FullScreenDiagram>)
    fireEvent.click(screen.getByRole('button', FULL_SCREEN))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('unknown block (B-States)', () => {
  it('shows its type as a dashed warn tag, "not supported here", and the block as data', () => {
    renderBlock({ type: 'walkthrough', steps: ['MARKER'] } as never)
    const tag = screen.getByText('walkthrough')
    expect(tag).toHaveAttribute('data-kind-tag')
    expect(tag.className).toContain('border-dashed')
    expect(tag.className).toContain('text-warn')
    expect(screen.getByText('not supported here')).toBeInTheDocument()
    expect(
      screen.getByText(
        'This reader does not know this block type yet. The content is below as data.',
      ),
    ).toBeInTheDocument()
    const summary = screen.getByText('Show raw block')
    expect(summary.tagName).toBe('SUMMARY')
    expect(summary.closest('details')?.textContent).toContain('"MARKER"')
  })
})

describe('BlockError', () => {
  it('lists the source with line numbers and marks the bad line', () => {
    const { container } = render(
      <BlockError
        message="Diagram could not be drawn. Parse error on line 3."
        source={'flowchart LR\n  A[request] --> B{tokens}\n  B -- yes --> C[serve'}
        lineNumber={3}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Diagram could not be drawn. Parse error on line 3.',
    )
    expect(container.querySelector('pre')?.textContent).toBe(
      '1  flowchart LR\n2    A[request] --> B{tokens}\n3    B -- yes --> C[serve',
    )
    expect(container.querySelector('[data-bad-line]')?.textContent).toBe(
      '3    B -- yes --> C[serve',
    )
  })
})
