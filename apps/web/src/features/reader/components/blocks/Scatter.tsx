'use client'
import type { EChartsOption } from 'echarts'
import type { Block } from '@brief/schema'
import { DiagramCard } from '../DiagramCard'
import { titleAnchor } from '../blockAnchor'
import type { BlockAnchor } from '../blockAnchor'
import { ChartExpandButton } from './ChartExpandButton'
import { useTheme } from '@/features/theme'
import { AXIS_FONT, PALETTES, seriesColors, useEChart } from '../../services/echarts'
import type { Palette } from '../../services/echarts'

type ScatterBlockType = Extract<Block, { type: 'scatter' }>

export function buildScatterOption(block: ScatterBlockType, palette: Palette): EChartsOption {
  const colors = seriesColors(palette)
  const nameTextStyle = { color: palette.sub, fontFamily: AXIS_FONT, fontSize: 10 }

  return {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      backgroundColor: palette.card,
      textStyle: { color: palette.text, fontFamily: AXIS_FONT, fontSize: 11 },
      borderColor: palette.line2,
    },
    grid: {
      top: 16,
      bottom: block.xLabel ? 50 : 34,
      left: block.yLabel ? 56 : 44,
      right: 16,
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      name: block.xLabel,
      nameLocation: 'middle',
      nameGap: 24,
      nameTextStyle,
      axisLabel: { color: palette.sub, fontFamily: AXIS_FONT, fontSize: 10 },
      axisLine: { lineStyle: { color: palette.sub } },
      splitLine: { lineStyle: { color: palette.line2 } },
    },
    yAxis: {
      type: 'value',
      name: block.yLabel,
      nameLocation: 'middle',
      nameGap: 24,
      nameTextStyle,
      axisLabel: { color: palette.sub, fontFamily: AXIS_FONT, fontSize: 10 },
      axisLine: { lineStyle: { color: palette.sub } },
      splitLine: { lineStyle: { color: palette.line2 } },
    },
    series: block.series.map((s, i) => ({
      name: s.label,
      type: 'scatter',
      symbolSize: 8,
      color: colors[i % colors.length],
      data: s.points,
    })),
  }
}

export function Scatter({ block, ...anchor }: { block: ScatterBlockType } & BlockAnchor) {
  const { theme } = useTheme()
  const palette = PALETTES[theme]

  const { containerRef, chartRef } = useEChart(() => buildScatterOption(block, palette), [block, theme])

  return (
    <DiagramCard
      caption={block.title ?? 'Scatter plot'}
      {...titleAnchor(anchor, block.title)}
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
