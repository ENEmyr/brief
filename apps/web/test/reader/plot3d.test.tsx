import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Block } from '@brief/schema'
import { AXIS_FONT, PALETTES } from '@/features/reader/services/echarts'
import { buildPlot3dOption, Plot3d, __resetWebGLCacheForTests } from '@/features/reader/components/blocks/Plot3d'

const palette = PALETTES.latte

const { useThemeMock } = vi.hoisted(() => ({ useThemeMock: vi.fn() }))
vi.mock('@/features/theme', () => ({ useTheme: useThemeMock }))

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
  useThemeMock.mockReturnValue({ theme: 'latte', toggle: vi.fn() })
  useEChartMock.mockReset()
  useEChartMock.mockReturnValue({
    containerRef: { current: null },
    chartRef: { current: null },
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
    const option = buildPlot3dOption(surfaceBlock, palette)
    const series = option.series as unknown as Array<{ type: string; data: [number, number, number][] }>
    expect(series[0]!.type).toBe('surface')
    expect(series[0]!.data).toEqual([
      [0, 0, 1],
      [1, 0, 2],
      [0, 1, 3],
      [1, 1, 4],
    ])
  })

  it('disables the surface wireframe', () => {
    const option = buildPlot3dOption(surfaceBlock, palette)
    const series = option.series as unknown as Array<{ wireframe: { show: boolean } }>
    expect(series[0]!.wireframe.show).toBe(false)
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

  it('uses the blue -> mauve gradient, low to high', () => {
    const option = buildPlot3dOption(scatterBlock, palette)
    const visualMap = option.visualMap as unknown as { inRange: { color: string[] } }
    expect(visualMap.inRange.color).toEqual([palette.blue, palette.mauve])
  })

  it('names the 3D axes from xLabel/yLabel/zLabel in mono, sub-colored text', () => {
    const option = buildPlot3dOption(scatterBlock, palette)
    const opt = option as unknown as {
      xAxis3D: { name?: string; nameTextStyle: { color: string; fontFamily: string } }
      yAxis3D: { name?: string }
      zAxis3D: { name?: string }
    }
    expect(opt.xAxis3D.name).toBe('x')
    expect(opt.yAxis3D.name).toBe('y')
    expect(opt.zAxis3D.name).toBe('z')
    expect(opt.xAxis3D.nameTextStyle.color).toBe(palette.sub)
    expect(opt.xAxis3D.nameTextStyle.fontFamily).toBe(AXIS_FONT)
  })

  it('omits axis names when xLabel/yLabel/zLabel are absent', () => {
    const option = buildPlot3dOption(surfaceBlock, palette)
    const opt = option as unknown as { xAxis3D: { name?: string } }
    expect(opt.xAxis3D.name).toBeUndefined()
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

  it('renders a WebGL-unavailable note when the canvas has no webgl context (jsdom default)', () => {
    render(<Plot3d block={scatterBlock} />)
    expect(screen.getByText('WebGL unavailable - 3D plot cannot render')).toBeInTheDocument()
    expect(screen.queryByLabelText('Expand chart')).not.toBeInTheDocument()
  })

  it('renders a no-data note for scatter3d with no points, even when webgl is available', () => {
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext') as unknown as ReturnType<
      typeof vi.fn
    >
    getContextSpy.mockReturnValue({})
    const empty: Extract<Block, { type: 'plot3d' }> = { type: 'plot3d', kind: 'scatter3d' }
    render(<Plot3d block={empty} />)
    expect(screen.getByText('No data for 3D plot')).toBeInTheDocument()
    getContextSpy.mockRestore()
  })

  it('renders a no-data note for surface with no grid, even when webgl is available', () => {
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext') as unknown as ReturnType<
      typeof vi.fn
    >
    getContextSpy.mockReturnValue({})
    const empty: Extract<Block, { type: 'plot3d' }> = { type: 'plot3d', kind: 'surface' }
    render(<Plot3d block={empty} />)
    expect(screen.getByText('No data for 3D plot')).toBeInTheDocument()
    getContextSpy.mockRestore()
  })

  it('renders the chart container and Expand control when webgl + data are both available', () => {
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext') as unknown as ReturnType<
      typeof vi.fn
    >
    getContextSpy.mockReturnValue({})
    render(<Plot3d block={scatterBlock} />)
    expect(useEChartMock).toHaveBeenCalled()
    expect(screen.getByLabelText('Expand chart')).toBeInTheDocument()
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
      chartRef: { current: { getDataURL } },
    })
    render(<Plot3d block={scatterBlock} />)
    fireEvent.click(screen.getByLabelText('Expand chart'))
    expect(getDataURL).toHaveBeenCalledWith(expect.objectContaining({ pixelRatio: 1 }))
    getContextSpy.mockRestore()
  })

  it('defaults the caption to "3D plot", or uses the block title', () => {
    const { rerender } = render(<Plot3d block={scatterBlock} />)
    expect(screen.getByText('3D plot')).toBeInTheDocument()
    rerender(<Plot3d block={{ ...scatterBlock, title: 'Loss surface' }} />)
    expect(screen.getByText('Loss surface')).toBeInTheDocument()
  })
})
