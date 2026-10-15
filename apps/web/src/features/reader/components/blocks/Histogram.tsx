'use client'
import type { EChartsOption } from 'echarts'
import type { Block } from '@brief/schema'
import { BlockCard, cardHeader } from '../BlockCard'
import type { BlockAnchor } from '../blockAnchor'
import { useChartCard } from '../fullScreen'
import { useTheme } from '@/features/theme'
import { chartPalette, chartTooltip, encodeHTML, useEChart } from '../../services/echarts'
import type { Palette } from '../../services/echarts'

type HistogramBlockType = Extract<Block, { type: 'histogram' }>

/** B-Blocks2:134: a 200px plot; the tick row sits 6px under it (B-Blocks2:133 gap). */
const PLOT = 200
const TICKS = 18

/** "12 (30.0%)": a bin's count and its share of all counts, as the hover shows them. */
export function binReadout(count: number, total: number): string {
  const share = total === 0 ? 0 : (count / total) * 100
  return `${count.toLocaleString('en-US')} (${share.toFixed(1)}%)`
}

/**
 * The 0-based first bin past the threshold, or null when there is none or its
 * `bin` is outside the bins (an unresolved reference is ignored).
 */
export function thresholdStart(block: HistogramBlockType): number | null {
  const bin = block.threshold?.bin
  return bin !== undefined && bin <= block.bins.length ? bin - 1 : null
}

/**
 * B-Blocks2:134-146: line2 bars 6px apart with 2px top corners on a line2
 * baseline, no value axis, and every bin's label in mono 10 faint under it.
 * Bins from the threshold on are red at .8 opacity (B-Blocks2:140-142).
 */
export function buildHistogramOption(block: HistogramBlockType, palette: Palette): EChartsOption {
  const total = block.bins.reduce((sum, b) => sum + b.count, 0)
  const past = thresholdStart(block)
  return {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      ...chartTooltip(palette),
      trigger: 'axis',
      axisPointer: { type: 'none' },
      formatter: (params: unknown) => {
        const [first] = params as { dataIndex: number }[]
        const bin = block.bins[first?.dataIndex ?? 0]
        return bin ? encodeHTML(`${bin.label} / ${binReadout(bin.count, total)}`) : ''
      },
    },
    grid: { top: 0, bottom: TICKS, left: 0, right: 0 },
    xAxis: {
      type: 'category',
      data: block.bins.map((b) => b.label),
      axisLine: { lineStyle: { color: palette.line2 } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { color: palette.faint, fontFamily: palette.font, fontSize: 10, margin: 6, interval: 0 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: block.bins.map((b, i) =>
          past !== null && i >= past
            ? { value: b.count, itemStyle: { color: palette.bad, opacity: 0.8 } }
            : b.count,
        ),
        barCategoryGap: 6,
        itemStyle: { color: palette.line2, borderRadius: [2, 2, 0, 0] },
      },
    ],
  }
}

export function Histogram({ block, ...anchor }: { block: HistogramBlockType } & BlockAnchor) {
  const { theme } = useTheme()

  const { containerRef, chartRef, ready, failed } = useEChart(
    () => buildHistogramOption(block, chartPalette(theme)),
    [block, theme],
  )
  const chartCard = useChartCard(chartRef, ready, theme, 2, failed, {
    heading: { kind: block.type, title: block.title },
  })
  const bins = block.bins.length
  const past = thresholdStart(block)
  const threshold = past === null ? undefined : block.threshold
  const left = past === null ? 0 : (past / bins) * 100

  return (
    <BlockCard
      {...cardHeader(block, anchor)}
      captionSuffix={`${bins} ${bins === 1 ? 'bin' : 'bins'}`}
      meta={threshold && <span className="shrink-0">{threshold.label} marked</span>}
      {...chartCard}
    >
      <div className="relative px-4 pb-2.5 pt-4">
        <div
          ref={containerRef}
          className={`w-full rounded-[4px] ${ready ? '' : 'sk'}`}
          style={{ height: PLOT + TICKS }}
        />
        {threshold && ready ? (
          // B-Blocks2:143-144: a dashed warn line on the left edge of the
          // threshold bin over the plot, its label 1% to the right of it.
          <div className="pointer-events-none absolute inset-x-4 top-4" style={{ height: PLOT }}>
            <div
              data-threshold-line
              className="absolute inset-y-0 w-0 border-l-[1.5px] border-dashed border-warn"
              style={{ left: `${left}%` }}
            />
            <span
              className="absolute top-0.5 whitespace-nowrap font-mono text-[11px] leading-[normal] text-warn"
              style={{ left: `${left + 1}%` }}
            >
              {threshold.value === undefined ? threshold.label : `${threshold.label} ${threshold.value}`}
            </span>
          </div>
        ) : null}
        {threshold ? (
          <p className="mb-0 mt-1.5 text-[12px] leading-[normal] text-sub">
            Bins past the agent's threshold turn red. Hover shows count and share.
          </p>
        ) : null}
      </div>
    </BlockCard>
  )
}
