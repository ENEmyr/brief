'use client'
import type { EChartsOption } from 'echarts'
import type { Block } from '@brief/schema'
import { DiagramCard } from '../DiagramCard'
import { titleCaption } from '../blockAnchor'
import type { BlockAnchor } from '../blockAnchor'
import { ChartExpandButton } from './ChartExpandButton'
import { useTheme } from '@/features/theme'
import { chartPalette, useEChart } from '../../services/echarts'
import type { Palette } from '../../services/echarts'

type HistogramBlockType = Extract<Block, { type: 'histogram' }>

export function buildHistogramOption(block: HistogramBlockType, palette: Palette): EChartsOption {
  return {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.card,
      textStyle: { color: palette.text, fontFamily: palette.font, fontSize: 11 },
      borderColor: palette.line2,
      axisPointer: { type: 'shadow' },
    },
    grid: { top: 16, bottom: 40, left: 44, right: 16, containLabel: true },
    xAxis: {
      type: 'category',
      data: block.bins.map((b) => b.label),
      axisLabel: { color: palette.sub, fontFamily: palette.font, fontSize: 10 },
      axisLine: { lineStyle: { color: palette.sub } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: palette.sub, fontFamily: palette.font, fontSize: 10 },
      axisLine: { lineStyle: { color: palette.sub } },
      splitLine: { lineStyle: { color: palette.line2 } },
    },
    series: [
      {
        type: 'bar',
        data: block.bins.map((b) => b.count),
        itemStyle: { color: palette.accentText, borderRadius: [4, 4, 0, 0] },
      },
    ],
  }
}

export function Histogram({ block, ...anchor }: { block: HistogramBlockType } & BlockAnchor) {
  const { theme } = useTheme()

  const { containerRef, chartRef } = useEChart(() => buildHistogramOption(block, chartPalette(theme)), [block, theme])

  return (
    <DiagramCard
      {...titleCaption(anchor, block.title, 'Histogram')}
      expandable={false}
      controls={
        <div className="flex justify-end">
          <ChartExpandButton chartRef={chartRef} theme={theme} />
        </div>
      }
    >
      <div ref={containerRef} className="h-[260px] w-full" />
    </DiagramCard>
  )
}
