import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Block } from '@brief/schema'
import { LIGHT_PALETTE } from './chart-palette'
import { buildPlot3dOption, Plot3d, __resetWebGLCacheForTests } from '@/features/reader/components/blocks/Plot3d'

const palette = LIGHT_PALETTE

const { useThemeMock } = vi.hoisted(() => ({ useThemeMock: vi.fn() }))
vi.mock('@/features/theme', () => ({
  useTheme: useThemeMock,
  readColorTokens: (theme: string, names: readonly string[]) =>
    Object.fromEntries(names.map((name) => [name, `${theme}:${name}`])),
  readFontStack: (kind: string) => `${kind}-stack`,
}))

const { useEChartMock } = vi.hoisted(() => ({ useEChartMock: vi.fn() }))
vi.mock('@/features/reader/services/echarts', async () => {
  const actual = await vi.importActual<typeof import('@/features/reader/services/echarts')>(
    '@/features/reader/services/echarts',
  )
  return {
    ...actual,
    useEChart: useEChartMock,
  }
})

beforeEach(() => {
  useThemeMock.mockReset()
  useThemeMock.mockReturnValue({ theme: 'light', toggle: vi.fn() })
  useEChartMock.mockReset()
  useEChartMock.mockReturnValue({
    containerRef: { current: null },
    chartRef: { current: null },
    // useEChart reports when the chart has drawn; these tests run against a drawn chart.
    ready: true,
  })
  // hasWebGL() caches its probe at module scope (Plot3d.tsx) so different
  // tests here can mock HTMLCanvasElement.prototype.getContext differently
  // (jsdom-default vs mocked-available) — force a fresh probe each test.
  __resetWebGLCacheForTests()
})

describe('Plot3d option builder', () => {
  const scatterBlock: Extract<Block, { type: 'plot3d' }> = {
    type: 'plot3d',
    kind: 'scatter3d',
    points: [
      [0, 0, 1],
      [1, 1, 5],
      [2, 2, 9],
    ],
    xLabel: 'x',
    yLabel: 'y',
    zLabel: 'z',
  }

  const surfaceBlock: Extract<Block, { type: 'plot3d' }> = {
    type: 'plot3d',
    kind: 'surface',
    grid: [
      [1, 2],
      [3, 4],
    ],
  }

  it('maps scatter3d points straight into the scatter3D series data', () => {
    const option = buildPlot3dOption(scatterBlock, palette)
    const series = option.series as unknown as Array<{ type: string; data: [number, number, number][] }>
    expect(series[0]!.type).toBe('scatter3D')
    expect(series[0]!.data).toEqual(scatterBlock.points)
  })

  it('builds surface data as [x,y,z] triples from the grid matrix (x=col idx, y=row idx)', () => {
    // The surface is now the last series, kept for the hover readout; the
    // board's wire lines draw it (next test).
    const option = buildPlot3dOption(surfaceBlock, palette)
    const series = option.series as unknown as Array<{ type: string; data: [number, number, number][] }>
    expect(series.at(-1)!.type).toBe('surface')
    expect(series.at(-1)!.data).toEqual([
      [0, 0, 1],
      [1, 0, 2],
      [0, 1, 3],
      [1, 1, 4],
    ])
  })

  it('draws the surface as wire lines: rows in the height ramp, columns in the plot3d grid color, no fill', () => {
    // Was a filled surface with a grid-color wireframe; B-Blocks2:170-177
    // draws only lines: one per row from #3B4A1C to #C5F05A by height, the
    // cross lines in #2A3330 (--c-plot3d-grid).
    const option = buildPlot3dOption(surfaceBlock, palette)
    const series = option.series as unknown as Array<{
      type: string
      data: number[][]
      silent?: boolean
      lineStyle?: { color?: string }
      itemStyle?: { opacity: number }
      wireframe?: { show: boolean }
    }>
    expect(series.map((s) => s.type)).toEqual(['line3D', 'line3D', 'line3D', 'line3D', 'surface'])
    expect(series.slice(0, 2).map((s) => s.data)).toEqual([
      [
        [0, 0, 1],
        [1, 0, 2],
      ],
      [
        [0, 1, 3],
        [1, 1, 4],
      ],
    ])
    expect(series.slice(0, 2).map((s) => s.lineStyle?.color)).toEqual([undefined, undefined])
    expect((option.visualMap as unknown as { seriesIndex: number[] }).seriesIndex).toEqual([0, 1])
    expect(series.slice(2, 4).map((s) => [s.data, s.lineStyle?.color, s.silent])).toEqual([
      [
        [
          [0, 0, 1],
          [0, 1, 3],
        ],
        palette.plot3dGrid,
        true,
      ],
      [
        [
          [1, 0, 2],
          [1, 1, 4],
        ],
        palette.plot3dGrid,
        true,
      ],
    ])
    expect(series[4]!.itemStyle?.opacity).toBe(0)
    expect(series[4]!.wireframe?.show).toBe(false)
  })

  it('sets a continuous visualMap over the z dimension, min/max from the data', () => {
    const option = buildPlot3dOption(scatterBlock, palette)
    const visualMap = option.visualMap as unknown as { min: number; max: number; dimension: number }
    expect(visualMap.dimension).toBe(2)
    expect(visualMap.min).toBe(1)
    expect(visualMap.max).toBe(9)
  })

  it('widens a degenerate all-equal-z dataset to max+1', () => {
    const flat: Extract<Block, { type: 'plot3d' }> = {
      type: 'plot3d',
      kind: 'scatter3d',
      points: [
        [0, 0, 5],
        [1, 1, 5],
      ],
    }
    const option = buildPlot3dOption(flat, palette)
    const visualMap = option.visualMap as unknown as { min: number; max: number }
    expect(visualMap.min).toBe(5)
    expect(visualMap.max).toBe(6)
  })

  it('maps height to the single-hue lime ramp, low to high, with no legend (B-Blocks2:172-176)', () => {
    // Was an info -> accent gradient with a visible legend bar.
    const option = buildPlot3dOption(scatterBlock, palette)
    const visualMap = option.visualMap as unknown as { show: boolean; inRange: { color: string[] } }
    expect(visualMap.inRange.color).toEqual(['#b9d98a', '#afd07c', '#99be5f', '#7ea73a', '#5e8c10'])
    expect(visualMap.show).toBe(false)
  })

  it('names the 3D axes from xLabel/yLabel/zLabel in mono 11, faint text (B-Blocks2:178-180)', () => {
    const option = buildPlot3dOption(scatterBlock, palette)
    const opt = option as unknown as {
      xAxis3D: { name?: string; nameTextStyle: { color: string; fontFamily: string } }
      yAxis3D: { name?: string }
      zAxis3D: { name?: string }
    }
    expect(opt.xAxis3D.name).toBe('x')
    expect(opt.yAxis3D.name).toBe('y')
    expect(opt.zAxis3D.name).toBe('z')
    // Was sub; the board's axis names are faint.
    expect(opt.xAxis3D.nameTextStyle.color).toBe(palette.faint)
    expect(opt.xAxis3D.nameTextStyle.fontFamily).toBe(palette.font)
  })

  it('omits axis names when xLabel/yLabel/zLabel are absent', () => {
    const option = buildPlot3dOption(surfaceBlock, palette)
    const opt = option as unknown as { xAxis3D: { name?: string } }
    expect(opt.xAxis3D.name).toBeUndefined()
  })

  it('keeps echarts\' own tooltip, which escapes payload text itself (no formatter returns HTML)', () => {
    const option = buildPlot3dOption(scatterBlock, palette)
    expect((option.tooltip as { formatter?: unknown }).formatter).toBeUndefined()
  })

  it('disables camera auto-rotate', () => {
    const option = buildPlot3dOption(scatterBlock, palette)
    const opt = option as unknown as { grid3D: { viewControl: { autoRotate: boolean } } }
    expect(opt.grid3D.viewControl.autoRotate).toBe(false)
  })
})

describe('Plot3d component', () => {
  const scatterBlock: Extract<Block, { type: 'plot3d' }> = {
    type: 'plot3d',
    kind: 'scatter3d',
    points: [[0, 0, 1]],
  }

  it('renders the WebGL-unavailable error card when the canvas has no webgl context (jsdom default)', () => {
    // Was an info note in the body; now the B-States error card (coordinator note 5).
    render(<Plot3d block={scatterBlock} />)
    expect(screen.getByRole('alert')).toHaveTextContent('WebGL unavailable - 3D plot cannot render')
    expect(screen.getByText('Show raw block')).toBeInTheDocument()
    // The full-screen button (B-Blocks2:166) replaced the 'Expand chart' pill; there
    // is still nothing to open when the chart cannot render.
    expect(screen.queryByRole('button', { name: 'Open diagram full screen' })).not.toBeInTheDocument()
  })

  it('renders the no-data error card for scatter3d with no points, even when webgl is available', () => {
    // Was a note in the body; a block with nothing to draw is now the B-States error card.
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext') as unknown as ReturnType<
      typeof vi.fn
    >
    getContextSpy.mockReturnValue({})
    const empty: Extract<Block, { type: 'plot3d' }> = { type: 'plot3d', kind: 'scatter3d' }
    render(<Plot3d block={empty} />)
    expect(screen.getByRole('alert')).toHaveTextContent('No data for 3D plot')
    getContextSpy.mockRestore()
  })

  it('renders the no-data error card for surface with no grid, even when webgl is available', () => {
    // Was a note in the body; a block with nothing to draw is now the B-States error card.
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext') as unknown as ReturnType<
      typeof vi.fn
    >
    getContextSpy.mockReturnValue({})
    const empty: Extract<Block, { type: 'plot3d' }> = { type: 'plot3d', kind: 'surface' }
    render(<Plot3d block={empty} />)
    expect(screen.getByRole('alert')).toHaveTextContent('No data for 3D plot')
    getContextSpy.mockRestore()
  })

  it('renders the chart container and the full-screen button when webgl + data are both available', () => {
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext') as unknown as ReturnType<
      typeof vi.fn
    >
    getContextSpy.mockReturnValue({})
    render(<Plot3d block={scatterBlock} />)
    expect(useEChartMock).toHaveBeenCalled()
    // B-Blocks2:166 header button, which replaced the 'Expand chart' pill.
    expect(screen.getByRole('button', { name: 'Open diagram full screen' })).toBeInTheDocument()
    getContextSpy.mockRestore()
  })

  it('captures the expanded chart at pixelRatio 1 (echarts-gl blanks the GL layer above 1)', () => {
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext') as unknown as ReturnType<
      typeof vi.fn
    >
    getContextSpy.mockReturnValue({})
    const getDataURL = vi.fn(() => 'data:image/png;base64,x')
    useEChartMock.mockReturnValue({
      containerRef: { current: null },
      // getWidth and getHeight size the snapshot in the viewer.
      chartRef: { current: { getDataURL, getWidth: () => 540, getHeight: () => 200 } },
      ready: true,
    })
    render(<Plot3d block={scatterBlock} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open diagram full screen' }))
    expect(getDataURL).toHaveBeenCalledWith({ pixelRatio: 1, backgroundColor: 'light:card' })
    getContextSpy.mockRestore()
  })

  it('shows the plot3d kind tag, and the block title as caption when there is one', () => {
    // The fallback caption '3D plot' is gone: the kind tag names the block
    // (B-Blocks2:166), and an untitled block shows no invented caption.
    const { rerender } = render(<Plot3d block={scatterBlock} />)
    expect(screen.getByText('plot3d')).toHaveAttribute('data-kind-tag')
    expect(screen.queryByText('3D plot')).not.toBeInTheDocument()
    rerender(<Plot3d block={{ ...scatterBlock, title: 'Loss surface' }} />)
    expect(screen.getByText('Loss surface')).toBeInTheDocument()
  })

  it('names the plot kind in the caption, after the title when there is one (B-Blocks2:166)', () => {
    const { rerender } = render(<Plot3d block={{ ...scatterBlock, kind: 'surface' }} />)
    expect(screen.getByText('plot3d').nextElementSibling).toHaveTextContent(/^surface$/)
    rerender(<Plot3d block={{ ...scatterBlock, kind: 'surface', title: 'latency by RPS' }} />)
    expect(screen.getByText('plot3d').nextElementSibling).toHaveTextContent(/^latency by RPS \/ surface$/)
  })
})
