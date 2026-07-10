import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Block } from '@brief/schema'
import { PALETTES } from '@/features/reader/services/echarts'
import {
  buildBigOOption,
  sampleNs,
  sliderToN,
  isCapped,
  fmt,
  DEFAULT_MAX_N,
  BigO,
} from '@/features/reader/components/blocks/BigO'
import { buildHeatmapOption, Heatmap } from '@/features/reader/components/blocks/Heatmap'
import { buildHistogramOption, Histogram } from '@/features/reader/components/blocks/Histogram'
import { buildScatterOption, Scatter } from '@/features/reader/components/blocks/Scatter'

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
})

describe('BigO option builder', () => {
  const block: Extract<Block, { type: 'bigo' }> = {
    type: 'bigo',
    series: [
      { label: 'Linear', curve: 'n' },
      { label: 'Exponential', curve: '2n' },
    ],
    maxN: 100,
  }

  it('samples 60 log-spaced integers from 1..maxN, deduped and sorted', () => {
    const xs = sampleNs(1000)
    expect(xs.length).toBeLessThanOrEqual(60)
    expect(xs[0]).toBe(1)
    expect(xs.at(-1)).toBe(1000)
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
    expect(new Set(xs).size).toBe(xs.length)
  })

  it('dedupes when maxN is small (fewer than 60 distinct rounded integers)', () => {
    const xs = sampleNs(10)
    expect(xs.length).toBeLessThan(60)
    expect(xs[0]).toBe(1)
    expect(xs.at(-1)).toBe(10)
  })

  it('maps slider value v (1..100) to n on a log scale, n=maxN at v=100', () => {
    expect(sliderToN(100, 10_000)).toBe(10_000)
    expect(sliderToN(1, 10_000)).toBeGreaterThanOrEqual(1)
    expect(sliderToN(50, 10_000)).toBe(Math.round(10_000 ** 0.5))
  })

  it('caps the 2n curve at n=30 to avoid overflow', () => {
    const curveFn = buildBigOOption(block, 50, palette).series as unknown as Array<{ data: [number, number][] }>
    const expBig = curveFn[1]!.data.find(([x]) => x === 100)
    expect(expBig?.[1]).toBe(2 ** 30)
  })

  it('flags 2n as capped only when maxN exceeds the 30 cap', () => {
    expect(isCapped('2n', 100)).toBe(true)
    expect(isCapped('2n', 30)).toBe(false)
    expect(isCapped('2n', 10)).toBe(false)
    expect(isCapped('n', 100)).toBe(false)
  })

  it('notes "capped" in the capped series name', () => {
    const option = buildBigOOption(block, 50, palette)
    const series = option.series as unknown as Array<{ name: string }>
    expect(series[0]!.name).toBe('Linear')
    expect(series[1]!.name).toContain('capped')
  })

  it('places a mauve dashed markLine at the current n on exactly one series', () => {
    const option = buildBigOOption(block, 42, palette)
    const series = option.series as unknown as Array<{ markLine?: { data: Array<{ xAxis: number }>; lineStyle: { color: string; type: string } } }>
    expect(series[0]!.markLine?.data).toEqual([{ xAxis: 42 }])
    expect(series[0]!.markLine?.lineStyle.color).toBe(palette.mauve)
    expect(series[0]!.markLine?.lineStyle.type).toBe('dashed')
    expect(series[1]!.markLine).toBeUndefined()
  })

  it('uses a log-scale y axis', () => {
    const option = buildBigOOption(block, 42, palette)
    expect((option.yAxis as unknown as { type: string }).type).toBe('log')
  })

  it('defaults maxN to 10_000 when the block omits it', () => {
    expect(DEFAULT_MAX_N).toBe(10_000)
  })

  it('formats ops with k/M/B suffixes at 1 decimal place, else the raw value', () => {
    expect(fmt(999)).toBe('999.0')
    expect(fmt(1_500)).toBe('1.5k')
    expect(fmt(2_500_000)).toBe('2.5M')
    expect(fmt(3_100_000_000)).toBe('3.1B')
  })
})

describe('Heatmap option builder', () => {
  const block: Extract<Block, { type: 'heatmap' }> = {
    type: 'heatmap',
    xLabels: ['a', 'b'],
    yLabels: ['x', 'y'],
    values: [
      [1, 5],
      [-2, 8],
    ],
  }

  it('maps values[][] to [xIdx,yIdx,value] triples', () => {
    const option = buildHeatmapOption(block, palette)
    const series = option.series as unknown as Array<{ data: [number, number, number][] }>
    expect(series[0]!.data).toEqual(
      expect.arrayContaining([
        [0, 0, 1],
        [1, 0, 5],
        [0, 1, -2],
        [1, 1, 8],
      ]),
    )
  })

  it('sets visualMap min/max to the true data min/max when negative values are present', () => {
    const option = buildHeatmapOption(block, palette)
    const visualMap = option.visualMap as unknown as { min: number; max: number }
    expect(visualMap.min).toBe(-2)
    expect(visualMap.max).toBe(8)
  })

  it('uses the TRUE data min for all-positive datasets (no clamp to 0)', () => {
    // Datasets like 50..100 need the gradient's full contrast range —
    // anchoring min at 0 would waste half of it below the data.
    const highRange = { ...block, values: [[50, 75], [60, 100]] }
    const option = buildHeatmapOption(highRange, palette)
    const visualMap = option.visualMap as unknown as { min: number; max: number }
    expect(visualMap.min).toBe(50)
    expect(visualMap.max).toBe(100)
  })

  it('widens a degenerate all-equal dataset to max+1 so the visualMap range stays valid', () => {
    const flat = { ...block, values: [[5, 5], [5, 5]] }
    const option = buildHeatmapOption(flat, palette)
    const visualMap = option.visualMap as unknown as { min: number; max: number }
    expect(visualMap.min).toBe(5)
    expect(visualMap.max).toBe(6)
  })

  it('uses the line2 -> mauve gradient', () => {
    const option = buildHeatmapOption(block, palette)
    const visualMap = option.visualMap as unknown as { inRange: { color: string[] } }
    expect(visualMap.inRange.color).toEqual([palette.line2, palette.mauve])
  })

  it('shows cell value labels when there are fewer than 12 columns', () => {
    const option = buildHeatmapOption(block, palette)
    const series = option.series as unknown as Array<{ label: { show: boolean } }>
    expect(series[0]!.label.show).toBe(true)
  })

  it('hides cell value labels at 12 or more columns', () => {
    const wide = { ...block, xLabels: Array.from({ length: 12 }, (_, i) => `c${i}`), values: [Array.from({ length: 12 }, () => 1)] }
    const option = buildHeatmapOption(wide, palette)
    const series = option.series as unknown as Array<{ label: { show: boolean } }>
    expect(series[0]!.label.show).toBe(false)
  })
})

describe('Histogram option builder', () => {
  const block: Extract<Block, { type: 'histogram' }> = {
    type: 'histogram',
    bins: [
      { label: '0-10', count: 3 },
      { label: '10-20', count: 7 },
    ],
  }

  it('builds a bar series from bins with mauve rounded-top bars', () => {
    const option = buildHistogramOption(block, palette)
    const series = option.series as unknown as Array<{ type: string; data: number[]; itemStyle: { color: string; borderRadius: number[] } }>
    expect(series[0]!.type).toBe('bar')
    expect(series[0]!.data).toEqual([3, 7])
    expect(series[0]!.itemStyle.color).toBe(palette.mauve)
    expect(series[0]!.itemStyle.borderRadius).toEqual([4, 4, 0, 0])
  })

  it('uses bin labels as x-axis categories', () => {
    const option = buildHistogramOption(block, palette)
    expect((option.xAxis as unknown as { data: string[] }).data).toEqual(['0-10', '10-20'])
  })
})

describe('Scatter option builder', () => {
  const block: Extract<Block, { type: 'scatter' }> = {
    type: 'scatter',
    xLabel: 'x',
    yLabel: 'y',
    series: [
      { label: 'A', points: [[1, 2]] },
      { label: 'B', points: [[3, 4]] },
      { label: 'C', points: [[5, 6]] },
      { label: 'D', points: [[7, 8]] },
      { label: 'E', points: [[9, 10]] },
      { label: 'F', points: [[11, 12]] },
      { label: 'G', points: [[13, 14]] },
      { label: 'H', points: [[15, 16]] },
    ],
  }

  it('builds one scatter series per block series, symbolSize 8', () => {
    const option = buildScatterOption(block, palette)
    const series = option.series as unknown as Array<{ type: string; symbolSize: number; data: number[][] }>
    expect(series).toHaveLength(8)
    expect(series[0]!.type).toBe('scatter')
    expect(series[0]!.symbolSize).toBe(8)
    expect(series[0]!.data).toEqual([[1, 2]])
  })

  it('cycles the series palette after 7 colors', () => {
    const option = buildScatterOption(block, palette)
    const series = option.series as unknown as Array<{ color: string }>
    const colors = [palette.mauve, palette.blue, palette.green, palette.peach, palette.teal, palette.red, palette.yellow]
    expect(series[0]!.color).toBe(colors[0])
    expect(series[6]!.color).toBe(colors[6])
    expect(series[7]!.color).toBe(colors[0]) // 8th series wraps back to mauve
  })

  it('sets optional x/y axis names', () => {
    const option = buildScatterOption(block, palette)
    expect((option.xAxis as unknown as { name?: string }).name).toBe('x')
    expect((option.yAxis as unknown as { name?: string }).name).toBe('y')
  })

  it('omits axis names when xLabel/yLabel are absent', () => {
    const unlabeled: Extract<Block, { type: 'scatter' }> = { type: 'scatter', series: block.series }
    const option = buildScatterOption(unlabeled, palette)
    expect((option.xAxis as unknown as { name?: string }).name).toBeUndefined()
  })
})

describe('BigO component (useEChart mocked)', () => {
  const block: Extract<Block, { type: 'bigo' }> = {
    type: 'bigo',
    series: [{ label: 'Linear', curve: 'n' }],
    maxN: 10_000,
  }

  it('calls useEChart with block/n/theme in the dependency list', () => {
    render(<BigO block={block} />)
    expect(useEChartMock).toHaveBeenCalled()
    const deps = useEChartMock.mock.calls[0]![1]
    expect(deps).toEqual([block, 10_000, 'latte'])
  })

  it('renders the slider and a readout row starting at n = maxN', () => {
    render(<BigO block={block} />)
    const slider = screen.getByLabelText('n (log scale)')
    expect(slider).toBeInTheDocument()
    expect(screen.getByText('10,000')).toBeInTheDocument()
  })

  it('updates the readout when the slider moves', () => {
    render(<BigO block={block} />)
    const slider = screen.getByLabelText('n (log scale)') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '50' } })
    const expectedN = Math.round(10_000 ** 0.5)
    expect(screen.getByText(expectedN.toLocaleString())).toBeInTheDocument()
  })

  it('defaults the caption to "Big-O comparison", or uses the block title', () => {
    const { rerender } = render(<BigO block={block} />)
    expect(screen.getByText('Big-O comparison')).toBeInTheDocument()
    rerender(<BigO block={{ ...block, title: 'Search complexity' }} />)
    expect(screen.getByText('Search complexity')).toBeInTheDocument()
  })
})

describe('Heatmap/Histogram/Scatter components (useEChart mocked)', () => {
  it('Heatmap calls useEChart and defaults its caption', () => {
    const block: Extract<Block, { type: 'heatmap' }> = {
      type: 'heatmap',
      xLabels: ['a'],
      yLabels: ['x'],
      values: [[1]],
    }
    render(<Heatmap block={block} />)
    expect(useEChartMock).toHaveBeenCalled()
    expect(screen.getByText('Heatmap')).toBeInTheDocument()
  })

  it('Histogram calls useEChart and defaults its caption', () => {
    const block: Extract<Block, { type: 'histogram' }> = {
      type: 'histogram',
      bins: [{ label: '0-10', count: 1 }],
    }
    render(<Histogram block={block} />)
    expect(useEChartMock).toHaveBeenCalled()
    expect(screen.getByText('Histogram')).toBeInTheDocument()
  })

  it('Histogram still captures its expanded chart at the default pixelRatio 2', () => {
    // Plot3d overrides ChartExpandButton's pixelRatio down to 1 (echarts-gl
    // blanks the WebGL layer above 1) — the canvas-only 2D charts must keep
    // the crisper 2x capture.
    const block: Extract<Block, { type: 'histogram' }> = {
      type: 'histogram',
      bins: [{ label: '0-10', count: 1 }],
    }
    const getDataURL = vi.fn(() => 'data:image/png;base64,x')
    useEChartMock.mockReturnValue({
      containerRef: { current: null },
      chartRef: { current: { getDataURL } },
    })
    render(<Histogram block={block} />)
    fireEvent.click(screen.getByLabelText('Expand chart'))
    expect(getDataURL).toHaveBeenCalledWith(expect.objectContaining({ pixelRatio: 2 }))
  })

  it('Scatter calls useEChart and defaults its caption', () => {
    const block: Extract<Block, { type: 'scatter' }> = {
      type: 'scatter',
      series: [{ label: 'A', points: [[1, 2]] }],
    }
    render(<Scatter block={block} />)
    expect(useEChartMock).toHaveBeenCalled()
    expect(screen.getByText('Scatter plot')).toBeInTheDocument()
  })
})
