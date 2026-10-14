'use client'
import type { EChartsOption } from 'echarts'
import type { Block } from '@brief/schema'
import { BlockCard, cardHeader } from '../BlockCard'
import type { BlockAnchor } from '../blockAnchor'
import { useChartCard } from '../fullScreen'
import { useTheme } from '@/features/theme'
import { chartPalette, chartTooltip, seriesColors, useEChart } from '../../services/echarts'
import type { Palette } from '../../services/echarts'

type ScatterBlockType = Extract<Block, { type: 'scatter' }>

/**
 * Series differ by shape as well as color (B-Blocks2:156-157, interactions.md
 * "chart series differ by shape"): a circle, then a square, then the rest.
 */
const SERIES_SHAPES = ['circle', 'rect', 'triangle', 'diamond'] as const

/** "5k", "1.2M": the compact number B-Blocks2:158 puts at the end of an axis. */
function compact(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
    .format(value)
    .toLowerCase()
}

function extent(values: number[]): [number, number] {
  return [Math.min(0, ...values), Math.max(...values)]
}

/**
 * B-Blocks2:153-158: line2 axes on the left and bottom, two grid-line rules,
 * 8px marks, and only the ends of each axis labelled in mono 10 faint, the
 * axis name after the last value ("5k rps", "3 s").
 */
export function buildScatterOption(block: ScatterBlockType, palette: Palette): EChartsOption {
  const colors = seriesColors(palette)
  const [xMin, xMax] = extent(block.series.flatMap((s) => s.points.map((p) => p[0])))
  const [yMin, yMax] = extent(block.series.flatMap((s) => s.points.map((p) => p[1])))
  const tick = { color: palette.faint, fontFamily: palette.font, fontSize: 10 }
  const end = (value: number, name: string | undefined) => (name ? `${compact(value)} ${name}` : compact(value))

  return {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      ...chartTooltip(palette),
      formatter: (params: unknown) => {
        const { seriesName, value } = params as { seriesName: string; value: [number, number] }
        return `${seriesName} / ${value[0].toLocaleString('en-US')}, ${value[1].toLocaleString('en-US')}`
      },
    },
    grid: { top: 10, bottom: 30, left: 40, right: 10 },
    xAxis: {
      type: 'value',
      min: xMin,
      max: xMax,
      axisLine: { show: true, lineStyle: { color: palette.line2 } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { ...tick, customValues: [xMin, xMax], formatter: (v: number) => (v === xMax ? end(v, block.xLabel) : compact(v)) },
    },
    yAxis: {
      type: 'value',
      min: yMin,
      max: yMax,
      splitNumber: 3,
      axisLine: { show: true, lineStyle: { color: palette.line2 } },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: palette.gridLine } },
      axisLabel: { ...tick, customValues: [yMax], formatter: (v: number) => end(v, block.yLabel) },
    },
    series: block.series.map((s, i) => ({
      name: s.label,
      type: 'scatter',
      symbol: SERIES_SHAPES[i % SERIES_SHAPES.length],
      symbolSize: 8,
      color: colors[i % colors.length],
      data: s.points,
    })),
  }
}

/** The header legend (B-Blocks2:151): an 8px swatch in the series' shape, then its label. */
function Legend({ block }: { block: ScatterBlockType }) {
  const colorClass = ['bg-bad', 'bg-accent-line', 'bg-info', 'bg-warn', 'bg-data-peach', 'bg-data-teal', 'bg-good']
  return (
    <>
      {block.series.map((s, i) => {
        const shape = SERIES_SHAPES[i % SERIES_SHAPES.length]
        return (
          <span key={i} className="flex shrink-0 items-center gap-[5px]">
            <span
              aria-hidden="true"
              className={`size-2 ${colorClass[i % colorClass.length]} ${
                shape === 'circle'
                  ? 'rounded-full'
                  : shape === 'rect'
                    ? 'rounded-[2px]'
                    : shape === 'triangle'
                      ? '[clip-path:polygon(50%_0,100%_100%,0_100%)]'
                      : 'rotate-45 scale-75'
              }`}
            />
            {s.label}
          </span>
        )
      })}
    </>
  )
}

export function Scatter({ block, ...anchor }: { block: ScatterBlockType } & BlockAnchor) {
  const { theme } = useTheme()

  const { containerRef, chartRef, ready, failed } = useEChart(
    () => buildScatterOption(block, chartPalette(theme)),
    [block, theme],
  )
  const chartCard = useChartCard(chartRef, ready, theme, 2, failed, {
    heading: { kind: block.type, title: block.title },
  })
  const count = block.series.length

  return (
    <BlockCard
      {...cardHeader(block, anchor)}
      captionSuffix={`${count} series`}
      meta={<Legend block={block} />}
      {...chartCard}
    >
      <div className="px-4 py-3">
        <div ref={containerRef} className={`aspect-[520/220] w-full rounded-[4px] ${ready ? '' : 'sk'}`} />
      </div>
    </BlockCard>
  )
}
