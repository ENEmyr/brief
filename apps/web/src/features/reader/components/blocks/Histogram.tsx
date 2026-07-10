'use client'
import type { EChartsOption } from 'echarts'
import type { Block } from '@brief/schema'
import { DiagramCard } from '../DiagramCard'
import { ChartExpandButton } from './ChartExpandButton'
import { useTheme } from '@/features/theme'
import { AXIS_FONT, PALETTES, useEChart } from '../../services/echarts'
import type { Palette } from '../../services/echarts'

type HistogramBlockType = Extract<Block, { type: 'histogram' }>

export function buildHistogramOption(block: HistogramBlockType, palette: Palette): EChartsOption {
  return {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.card,
      textStyle: { color: palette.text, fontFamily: AXIS_FONT, fontSize: 11 },
      borderColor: palette.line2,
      axisPointer: { type: 'shadow' },
    },
    grid: { top: 16, bottom: 40, left: 44, right: 16, containLabel: true },
    xAxis: {
      type: 'category',
      data: block.bins.map((b) => b.label),
      axisLabel: { color: palette.sub, fontFamily: AXIS_FONT, fontSize: 10 },
      axisLine: { lineStyle: { color: palette.sub } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: palette.sub, fontFamily: AXIS_FONT, fontSize: 10 },
      axisLine: { lineStyle: { color: palette.sub } },
      splitLine: { lineStyle: { color: palette.line2 } },
    },
    series: [
      {
        type: 'bar',
        data: block.bins.map((b) => b.count),
        itemStyle: { color: palette.mauve, borderRadius: [4, 4, 0, 0] },
      },
    ],
  }
}

export function Histogram({ block }: { block: HistogramBlockType }) {
  const { theme } = useTheme()
  const palette = PALETTES[theme]

  const { containerRef, chartRef } = useEChart(() => buildHistogramOption(block, palette), [block, theme])

  return (
    <DiagramCard
      caption={block.title ?? 'Histogram'}
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
