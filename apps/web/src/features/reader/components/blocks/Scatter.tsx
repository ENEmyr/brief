'use client'
import type { EChartsOption } from 'echarts'
import type { Block } from '@brief/schema'
import { BlockCard, cardHeader } from '../BlockCard'
import type { BlockAnchor } from '../blockAnchor'
import { useChartCard } from '../fullScreen'
import { useTheme } from '@/features/theme'
import { chartPalette, seriesColors, useEChart } from '../../services/echarts'
import type { Palette } from '../../services/echarts'

type ScatterBlockType = Extract<Block, { type: 'scatter' }>

export function buildScatterOption(block: ScatterBlockType, palette: Palette): EChartsOption {
  const colors = seriesColors(palette)
  const nameTextStyle = { color: palette.sub, fontFamily: palette.font, fontSize: 10 }

  return {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      backgroundColor: palette.card,
      textStyle: { color: palette.text, fontFamily: palette.font, fontSize: 11 },
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
      axisLabel: { color: palette.sub, fontFamily: palette.font, fontSize: 10 },
      axisLine: { lineStyle: { color: palette.sub } },
      splitLine: { lineStyle: { color: palette.line2 } },
    },
    yAxis: {
      type: 'value',
      name: block.yLabel,
      nameLocation: 'middle',
      nameGap: 24,
      nameTextStyle,
      axisLabel: { color: palette.sub, fontFamily: palette.font, fontSize: 10 },
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

  const { containerRef, chartRef, ready } = useEChart(() => buildScatterOption(block, chartPalette(theme)), [block, theme])

  const chartCard = useChartCard(chartRef, ready, theme)

  return (
    <BlockCard {...cardHeader(block, anchor)} {...chartCard}>
      <div className="px-4 py-3">
        <div
          ref={containerRef}
          className={`h-[260px] w-full ${ready ? '' : 'sk'}`}
          style={{ borderRadius: 4 }}
        />
      </div>
    </BlockCard>
  )
}
