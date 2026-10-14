'use client'
import type { EChartsOption } from 'echarts'
import type { Block } from '@brief/schema'
import { BlockCard, cardHeader, type BlockCardState } from '../BlockCard'
import type { BlockAnchor } from '../blockAnchor'
import { useChartCard } from '../fullScreen'
import { useTheme } from '@/features/theme'
import { chartPalette, chartTooltip, encodeHTML, useEChart } from '../../services/echarts'
import type { Palette } from '../../services/echarts'

type HeatmapBlockType = Extract<Block, { type: 'heatmap' }>

/** B-Blocks:181: 18px rows, 3px apart, after a 28px label column. */
const ROW = 18
const GAP = 3
const LABEL_COL = 28
/** The tick row under the grid (B-Blocks:185: 4px above, 10px mono). */
const TICKS = 18

/**
 * The values grid must have one row per y label and one value per x label.
 * The schema cannot say so, so a mismatch is caught here and shown as a
 * failed chart with the offending row marked, not drawn half-empty.
 */
export function heatmapIssue(block: HeatmapBlockType): { message: 'Chart could not be drawn.'; source: string; lineNumber?: number } | null {
  const rows = block.values.length === block.yLabels.length
  const badRow = block.values.findIndex((row) => row.length !== block.xLabels.length)
  if (rows && badRow < 0) return null
  // One line per array of numbers or labels, so a row reads as a row.
  const source = JSON.stringify(block, null, 2).replace(/\[\s+([^[\]{}]*?)\s+\]/g, (_, inner: string) => `[${inner.split(/,\s+/).join(', ')}]`)
  const lines = source.split('\n')
  const valuesLine = lines.findIndex((line) => line.trimStart().startsWith('"values"'))
  let lineIndex = valuesLine
  if (rows && valuesLine >= 0) {
    // Each row opens on its own line, one level deeper than "values".
    const indent = `${lines[valuesLine]?.match(/^\s*/)?.[0] ?? ''}  [`
    let seen = -1
    for (let i = valuesLine + 1; i < lines.length; i++) {
      if (lines[i]?.startsWith(indent)) seen += 1
      if (seen === badRow) {
        lineIndex = i
        break
      }
    }
  }
  return { message: 'Chart could not be drawn.', source, lineNumber: lineIndex >= 0 ? lineIndex + 1 : undefined }
}

/** Grid height in px for `rows` rows, plus the tick row: fixed before echarts draws, so the card never moves. */
function heatmapHeight(rows: number): number {
  return rows * (ROW + GAP) - GAP + TICKS
}

/**
 * B-Blocks:180-186: a five-step lime ramp from the panel's raised fill to the
 * accent, no legend, mono 10 faint labels, and the hovered cell outlined in the
 * text color with an inverted chip naming row, column and value.
 */
export function buildHeatmapOption(block: HeatmapBlockType, palette: Palette): EChartsOption {
  const flatValues = block.values.flat()
  // True data min/max (not clamped to 0): for datasets like 50..100 the
  // ramp's full contrast range matters more than a zero anchor. Degenerate
  // all-equal datasets get max+1 so the visualMap range never collapses.
  const min = Math.min(...flatValues)
  const dataMax = Math.max(...flatValues)
  const max = dataMax === min ? dataMax + 1 : dataMax
  const label = { color: palette.faint, fontFamily: palette.font, fontSize: 10 }

  const data: [number, number, number][] = []
  block.yLabels.forEach((_, yi) => {
    block.xLabels.forEach((_, xi) => {
      data.push([xi, yi, block.values[yi]?.[xi] ?? 0])
    })
  })

  return {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      ...chartTooltip(palette),
      formatter: (params: unknown) => {
        const [x, y, value] = (params as { value: [number, number, number] }).value
        return encodeHTML(`${block.yLabels[y] ?? ''} ${block.xLabels[x] ?? ''} / ${value.toLocaleString('en-US')}`)
      },
    },
    grid: { top: 0, bottom: TICKS, left: LABEL_COL + GAP, right: 0 },
    xAxis: {
      type: 'category',
      data: [...block.xLabels],
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { ...label, margin: 8 },
    },
    yAxis: {
      type: 'category',
      data: [...block.yLabels],
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { ...label, align: 'left', margin: LABEL_COL + GAP },
    },
    visualMap: {
      type: 'piecewise',
      min,
      max,
      splitNumber: palette.heat.length,
      show: false,
      inRange: { color: [...palette.heat] },
    },
    series: [
      {
        type: 'heatmap',
        data,
        label: { show: false },
        itemStyle: { borderColor: palette.card, borderWidth: GAP / 2 },
        emphasis: { itemStyle: { borderColor: palette.text, borderWidth: 1 } },
      },
    ],
  }
}

export function Heatmap({ block, ...anchor }: { block: HeatmapBlockType } & BlockAnchor) {
  const { theme } = useTheme()
  const issue = heatmapIssue(block)

  const { containerRef, chartRef, ready, failed } = useEChart(
    () => buildHeatmapOption(block, chartPalette(theme)),
    [block, theme],
  )
  const chartCard = useChartCard(chartRef, ready, theme, 2, failed, {
    heading: { kind: block.type, title: block.title },
  })
  const state: BlockCardState | undefined = issue ? { status: 'error', ...issue } : chartCard.state

  return (
    <BlockCard
      {...cardHeader(block, anchor)}
      meta={state?.status === 'error' ? undefined : <span className="shrink-0">hover a cell</span>}
      fullScreen={chartCard.fullScreen}
      state={state}
    >
      <div className="p-3">
        <div
          ref={containerRef}
          className={`w-full rounded-[4px] ${ready ? '' : 'sk'}`}
          style={{ height: heatmapHeight(block.yLabels.length) }}
        />
      </div>
    </BlockCard>
  )
}
