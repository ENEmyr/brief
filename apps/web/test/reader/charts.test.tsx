import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Block } from '@brief/schema'
import { LIGHT_PALETTE } from './chart-palette'
import {
  buildBigOOption,
  sampleNs,
  sliderToN,
  isCapped,
  fmt,
  DEFAULT_MAX_N,
  BigO,
  curveColors,
  tickLabel,
} from '@/features/reader/components/blocks/BigO'
import { buildHeatmapOption, Heatmap } from '@/features/reader/components/blocks/Heatmap'
import { binReadout, buildHistogramOption, Histogram } from '@/features/reader/components/blocks/Histogram'
import { buildScatterOption, Scatter } from '@/features/reader/components/blocks/Scatter'
import { DiagramViewerProvider } from '@/features/diagram-viewer'

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

  it('places a faint dashed markLine at the current n on exactly one series', () => {
    // Was accent: on B-Blocks:134 lime is the slowest curve's own line, so the
    // slider's marker (D5, no board) takes faint to stay apart from it.
    const option = buildBigOOption(block, 42, palette)
    const series = option.series as unknown as Array<{ markLine?: { data: Array<{ xAxis: number }>; lineStyle: { color: string; type: string } } }>
    expect(series[0]!.markLine?.data).toEqual([{ xAxis: 42 }])
    expect(series[0]!.markLine?.lineStyle.color).toBe(palette.faint)
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

  it('colors curves by growth: the slowest lime, the fastest red, amber between (B-Blocks:132-135)', () => {
    const series: Extract<Block, { type: 'bigo' }>['series'] = [
      { label: 'O(n)', curve: 'n' },
      { label: 'O(log n)', curve: 'logn' },
      { label: 'O(1)', curve: '1' },
    ]
    expect(curveColors(series, palette)).toEqual([palette.bad, palette.warn, palette.accentLine])
    expect(curveColors([{ label: 'only', curve: 'n2' }], palette)).toEqual([palette.accentLine])
  })

  it('labels the ends of the n axis, a power of ten as 10 with a superscript (B-Blocks:136)', () => {
    expect(tickLabel(1)).toBe('1')
    expect(tickLabel(10)).toBe('10')
    expect(tickLabel(1_000_000)).toBe('10⁶')
    expect(tickLabel(10_000)).toBe('10⁴')
    expect(tickLabel(5_000)).toBe('5,000')
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
    expect(series[0]!.data).toEqual([
      [0, 0, 1],
      [1, 0, 5],
      [0, 1, -2],
      [1, 1, 8],
    ])
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

  it('steps through the five-step heat ramp, elev to accent (B-Blocks:181-184)', () => {
    // Was a two-stop line2 -> accent gradient; the board draws five flat steps.
    const option = buildHeatmapOption(block, palette)
    const visualMap = option.visualMap as unknown as { type: string; splitNumber: number; show: boolean; inRange: { color: string[] } }
    expect(visualMap.type).toBe('piecewise')
    expect(visualMap.splitNumber).toBe(5)
    expect(visualMap.show).toBe(false)
    expect(visualMap.inRange.color).toEqual(['#f9fafa', '#eef8d9', '#e0f5af', '#d3f384', '#c5f05a'])
  })

  it('names every third column and the last, as B-Blocks:185 writes 00 06 12 18 22', () => {
    const hours = ['00', '02', '04', '06', '08', '10', '12', '14', '16', '18', '20', '22']
    const option = buildHeatmapOption({ type: 'heatmap', xLabels: hours, yLabels: ['a'], values: [hours.map(() => 1)] }, palette)
    const { interval } = (option.xAxis as unknown as { axisLabel: { interval: (i: number) => boolean } }).axisLabel
    expect(hours.filter((_, i) => interval(i))).toEqual(['00', '06', '12', '18', '22'])
    const few = buildHeatmapOption({ type: 'heatmap', xLabels: ['a', 'b'], yLabels: ['y'], values: [[1, 2]] }, palette)
    const fewInterval = (few.xAxis as unknown as { axisLabel: { interval: (i: number) => boolean } }).axisLabel.interval
    expect([0, 1].map(fewInterval)).toEqual([true, true])
  })

  it('shows no cell value labels, at any column count (B-Blocks:181)', () => {
    // Was: labels under 12 columns. The board's cells carry color only; the
    // value is in the hover chip (B-Blocks:186).
    const option = buildHeatmapOption(block, palette)
    const series = option.series as unknown as Array<{ label: { show: boolean } }>
    expect(series[0]!.label.show).toBe(false)
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

  it('builds a bar series from bins with line2 bars, 2px top corners, 6px apart', () => {
    // Was accent bars with 4px corners; B-Blocks2:135-142 draws line2 bars
    // with 2px corners 6px apart (red past a threshold the payload lacks).
    const option = buildHistogramOption(block, palette)
    const series = option.series as unknown as Array<{ type: string; data: number[]; barCategoryGap: number; itemStyle: { color: string; borderRadius: number[] } }>
    expect(series[0]!.type).toBe('bar')
    expect(series[0]!.data).toEqual([3, 7])
    expect(series[0]!.itemStyle.color).toBe(palette.line2)
    expect(series[0]!.itemStyle.borderRadius).toEqual([2, 2, 0, 0])
    expect(series[0]!.barCategoryGap).toBe(6)
  })

  it('reads a bin out as its count and its share of all counts', () => {
    expect(binReadout(3, 10)).toBe('3 (30.0%)')
    expect(binReadout(0, 0)).toBe('0 (0.0%)')
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

  it('cycles the series palette after 7 colors, red then lime first, and the shapes after 4', () => {
    // Was accent first; B-Blocks2:156-157 draws "before" as red circles and
    // "after" as lime squares, so red and lime lead and shape tells them apart.
    const option = buildScatterOption(block, palette)
    const series = option.series as unknown as Array<{ color: string; symbol: string }>
    const colors = [
      palette.bad,
      palette.accentLine,
      palette.info,
      palette.warn,
      palette.dataOrange,
      palette.dataTeal,
      palette.good,
    ]
    expect(series.map((s) => s.color)).toEqual([...colors, colors[0]])
    expect(series.map((s) => s.symbol)).toEqual(['circle', 'rect', 'triangle', 'diamond', 'circle', 'rect', 'triangle', 'diamond'])
  })

  type Axis = { name?: string; axisLabel: { customValues: number[]; formatter: (v: number) => string } }

  it('names the axes after their last value, as B-Blocks2:158 writes "5k rps" and "3 s"', () => {
    // Was echarts axis titles; the board puts the unit on the end tick.
    const option = buildScatterOption(block, palette)
    const x = option.xAxis as unknown as Axis
    const y = option.yAxis as unknown as Axis
    expect(x.name).toBeUndefined()
    expect(x.axisLabel.customValues).toEqual([0, 15])
    expect(x.axisLabel.formatter(15)).toBe('15 x')
    expect(x.axisLabel.formatter(0)).toBe('0')
    expect(y.axisLabel.customValues).toEqual([16])
    expect(y.axisLabel.formatter(16)).toBe('16 y')
  })

  it('writes the end values alone when xLabel/yLabel are absent', () => {
    const unlabeled: Extract<Block, { type: 'scatter' }> = { type: 'scatter', series: [{ label: 'A', points: [[5000, 3]] }] }
    const option = buildScatterOption(unlabeled, palette)
    expect((option.xAxis as unknown as Axis).axisLabel.formatter(5000)).toBe('5k')
    expect((option.yAxis as unknown as Axis).axisLabel.formatter(3)).toBe('3')
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
    expect(deps).toEqual([block, 10_000, 'light'])
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

  it('shows the bigo kind tag, and the block title as caption when there is one', () => {
    // The fallback caption is gone: the kind tag names the block (B-Blocks
    // headers), and an untitled block shows no invented caption.
    const { rerender } = render(<BigO block={block} />)
    expect(screen.getByText('bigo')).toHaveAttribute('data-kind-tag')
    expect(screen.queryByText('Big-O comparison')).not.toBeInTheDocument()
    rerender(<BigO block={{ ...block, title: 'Search complexity' }} />)
    expect(screen.getByText('Search complexity')).toBeInTheDocument()
  })
})

describe('Heatmap/Histogram/Scatter components (useEChart mocked)', () => {
  it('Heatmap calls useEChart and shows its kind tag', () => {
    // The fallback caption is gone: the kind tag names the block (B-Blocks
    // headers), and an untitled block shows no invented caption.
    const block: Extract<Block, { type: 'heatmap' }> = {
      type: 'heatmap',
      xLabels: ['a'],
      yLabels: ['x'],
      values: [[1]],
    }
    render(<Heatmap block={block} />)
    expect(useEChartMock).toHaveBeenCalled()
    expect(screen.getByText('heatmap')).toHaveAttribute('data-kind-tag')
    expect(screen.queryByText('Heatmap')).not.toBeInTheDocument()
  })

  it('Histogram calls useEChart and shows its kind tag', () => {
    const block: Extract<Block, { type: 'histogram' }> = {
      type: 'histogram',
      bins: [{ label: '0-10', count: 1 }],
    }
    render(<Histogram block={block} />)
    expect(useEChartMock).toHaveBeenCalled()
    expect(screen.getByText('histogram')).toHaveAttribute('data-kind-tag')
    expect(screen.queryByText('Histogram')).not.toBeInTheDocument()
  })

  it('Histogram still captures its expanded chart at the default pixelRatio 2', () => {
    // Plot3d overrides the capture pixelRatio down to 1 (echarts-gl blanks
    // the WebGL layer above 1) — the canvas-only 2D charts must keep the
    // crisper 2x capture. The control is now the card header's full-screen
    // button (B-Blocks2:28 label), which replaced the 'Expand chart' pill.
    const block: Extract<Block, { type: 'histogram' }> = {
      type: 'histogram',
      bins: [{ label: '0-10', count: 1 }],
    }
    const getDataURL = vi.fn(() => 'data:image/png;base64,x')
    useEChartMock.mockReturnValue({
      containerRef: { current: null },
      // getWidth and getHeight size the snapshot in the viewer.
      chartRef: { current: { getDataURL, getWidth: () => 540, getHeight: () => 200 } },
      ready: true,
    })
    render(<Histogram block={block} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open diagram full screen' }))
    expect(getDataURL).toHaveBeenCalledWith({ pixelRatio: 2, backgroundColor: 'light:card' })
  })

  it('shows the full-screen snapshot at the chart\'s own size, so the viewer can fit it before it decodes', () => {
    useEChartMock.mockReturnValue({
      containerRef: { current: null },
      chartRef: { current: { getDataURL: () => 'data:image/png;base64,x', getWidth: () => 540, getHeight: () => 200 } },
      ready: true,
    })
    render(
      <DiagramViewerProvider>
        <Histogram block={{ type: 'histogram', bins: [{ label: '0-10', count: 1 }] }} />
      </DiagramViewerProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open diagram full screen' }))
    const img = screen.getByRole('dialog', { name: 'Diagram viewer' }).querySelector('img')
    expect(img).toHaveAttribute('width', '540')
    expect(img).toHaveAttribute('height', '200')
  })

  it('Scatter calls useEChart and shows its kind tag', () => {
    const block: Extract<Block, { type: 'scatter' }> = {
      type: 'scatter',
      series: [{ label: 'A', points: [[1, 2]] }],
    }
    render(<Scatter block={block} />)
    expect(useEChartMock).toHaveBeenCalled()
    expect(screen.getByText('scatter')).toHaveAttribute('data-kind-tag')
    expect(screen.queryByText('Scatter plot')).not.toBeInTheDocument()
  })

  it('Scatter says how its series differ under the chart, once there are two (B-Blocks2:160)', () => {
    const sentence = 'Series differ by shape and color, so grayscale and color-blind readers can tell them apart.'
    const one: Extract<Block, { type: 'scatter' }> = { type: 'scatter', series: [{ label: 'A', points: [[1, 2]] }] }
    const { rerender } = render(<Scatter block={one} />)
    expect(screen.queryByText(sentence)).not.toBeInTheDocument()

    rerender(<Scatter block={{ ...one, series: [...one.series, { label: 'B', points: [[3, 4]] }] }} />)
    expect(screen.getByText(sentence)).toBeInTheDocument()
  })
})

describe('chart failures inside the card (B-States:92-98, features.md B6)', () => {
  it('a heatmap whose rows do not match its labels fails in its card with the bad row marked', () => {
    const block: Extract<Block, { type: 'heatmap' }> = {
      type: 'heatmap',
      xLabels: ['a', 'b', 'c'],
      yLabels: ['x', 'y'],
      values: [
        [1, 2, 3],
        [4, 5],
      ],
    }
    const { container } = render(<Heatmap block={block} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Chart could not be drawn.')
    expect(container.querySelector('[data-bad-line]')).toHaveTextContent('[4, 5]')
    expect(screen.queryByText('hover a cell')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open diagram full screen' })).not.toBeInTheDocument()
  })

  it('a chart whose echarts never loads leaves "loading chart" for the error card, with no error text of its own', () => {
    useEChartMock.mockReturnValue({ containerRef: { current: null }, chartRef: { current: null }, ready: false, failed: true })
    render(<BigO block={{ type: 'bigo', series: [{ label: 'Linear', curve: 'n' }] }} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/^Chart could not be drawn\.$/)
    expect(screen.queryByText('loading chart')).not.toBeInTheDocument()
    expect(screen.queryByText('log scale')).not.toBeInTheDocument()
  })
})

// echarts writes a tooltip formatter's string into the page as HTML. A label
// is brief-author text that reaches every reader of a shared link, so each
// formatter must hand it back as literal text.
describe('chart tooltips keep payload text literal', () => {
  const HOSTILE = '<img src=x onerror="window.__xss=1">'
  type Formatter = (params: unknown) => string

  function asHtml(markup: string) {
    const host = document.createElement('div')
    host.innerHTML = markup
    return host
  }

  afterEach(() => {
    delete (window as { __xss?: number }).__xss
  })

  it('heatmap: a hostile row or column label shows as text, and no element is made', () => {
    const block: Extract<Block, { type: 'heatmap' }> = { type: 'heatmap', xLabels: [HOSTILE], yLabels: ['&'], values: [[3]] }
    const tooltip = buildHeatmapOption(block, palette).tooltip as { formatter: Formatter }
    const host = asHtml(tooltip.formatter({ value: [0, 0, 3] }))
    expect(host.textContent).toBe(`& ${HOSTILE} / 3`)
    expect(host.querySelector('img')).toBeNull()
    expect((window as { __xss?: number }).__xss).toBeUndefined()
  })

  it('histogram: a hostile bin label shows as text, and no element is made', () => {
    const block: Extract<Block, { type: 'histogram' }> = { type: 'histogram', bins: [{ label: HOSTILE, count: 1 }] }
    const tooltip = buildHistogramOption(block, palette).tooltip as { formatter: Formatter }
    const host = asHtml(tooltip.formatter([{ dataIndex: 0 }]))
    expect(host.textContent).toBe(`${HOSTILE} / 1 (100.0%)`)
    expect(host.querySelector('img')).toBeNull()
  })

  it('scatter: a hostile series label shows as text, and no element is made', () => {
    const tooltip = buildScatterOption({ type: 'scatter', series: [{ label: HOSTILE, points: [[1, 2]] }] }, palette)
      .tooltip as { formatter: Formatter }
    const host = asHtml(tooltip.formatter({ seriesName: HOSTILE, value: [1, 2] }))
    expect(host.textContent).toBe(`${HOSTILE} / 1, 2`)
    expect(host.querySelector('img')).toBeNull()
  })

  it('bigo keeps echarts\' own tooltip, which escapes series names itself', () => {
    const bigo = buildBigOOption({ type: 'bigo', series: [{ label: HOSTILE, curve: 'n' }] }, 10, palette)
    expect((bigo.tooltip as { formatter?: unknown }).formatter).toBeUndefined()
  })
})
