'use client'
import type { EChartsOption } from 'echarts'
import type { Block } from '@brief/schema'
import { DiagramCard } from '../DiagramCard'
import { ChartExpandButton } from './ChartExpandButton'
import { useTheme } from '@/features/theme'
import { AXIS_FONT, PALETTES, useEChart } from '../../services/echarts'
import type { Palette } from '../../services/echarts'

type HeatmapBlockType = Extract<Block, { type: 'heatmap' }>

// Value labels get unreadable past this many columns.
const LABEL_COLUMN_LIMIT = 12

export function buildHeatmapOption(block: HeatmapBlockType, palette: Palette): EChartsOption {
  const flatValues = block.values.flat()
  const dataMin = Math.min(...flatValues)
  const dataMax = Math.max(...flatValues)
  const min = dataMin >= 0 ? 0 : dataMin
  const max = dataMax
  const showLabel = block.xLabels.length < LABEL_COLUMN_LIMIT

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
      backgroundColor: palette.card,
      textStyle: { color: palette.text, fontFamily: AXIS_FONT, fontSize: 11 },
      borderColor: palette.line2,
    },
    grid: { top: 12, bottom: 64, left: 64, right: 20, containLabel: true },
    xAxis: {
      type: 'category',
      data: [...block.xLabels],
      splitArea: { show: true },
      axisLabel: { color: palette.sub, fontFamily: AXIS_FONT, fontSize: 10 },
      axisLine: { lineStyle: { color: palette.sub } },
    },
    yAxis: {
      type: 'category',
      data: [...block.yLabels],
      splitArea: { show: true },
      axisLabel: { color: palette.sub, fontFamily: AXIS_FONT, fontSize: 10 },
      axisLine: { lineStyle: { color: palette.sub } },
    },
    visualMap: {
      min,
      max,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      show: true,
      inRange: { color: [palette.line2, palette.mauve] },
      textStyle: { color: palette.sub, fontFamily: AXIS_FONT, fontSize: 10 },
    },
    series: [
      {
        type: 'heatmap',
        data,
        label: { show: showLabel, color: palette.text, fontSize: 9, fontFamily: AXIS_FONT },
        itemStyle: { borderColor: palette.card, borderWidth: 1 },
      },
    ],
  }
}

export function Heatmap({ block }: { block: HeatmapBlockType }) {
  const { theme } = useTheme()
  const palette = PALETTES[theme]

  const { containerRef, chartRef } = useEChart(() => buildHeatmapOption(block, palette), [block, theme])

  return (
    <DiagramCard
      caption={block.title ?? 'Heatmap'}
      expandable={false}
      controls={
        <div className="flex justify-end">
          <ChartExpandButton chartRef={chartRef} palette={palette} />
        </div>
      }
    >
      <div ref={containerRef} className="h-[260px] w-full" />
    </DiagramCard>
  )
}
