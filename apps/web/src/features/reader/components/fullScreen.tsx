'use client'
import { useCallback, useEffect, useId } from 'react'
import type { ReactNode, RefObject } from 'react'
import type { EChartsType } from 'echarts/core'
import { useDiagramViewer } from '@/features/diagram-viewer'
import type { Theme } from '@/features/theme'
import { chartPalette } from '../services/echarts'
import { LOADING, type BlockCardProps } from './BlockCard'

export function useDiagramFullScreen(node: ReactNode): () => void {
  const ownerKey = useId()
  const { expandedKey, open, sync } = useDiagramViewer()
  const isExpanded = expandedKey === ownerKey

  useEffect(() => {
    if (isExpanded) sync(ownerKey, node)
  }, [isExpanded, sync, ownerKey, node])

  return () => open(ownerKey, node)
}

/** The card props of an echarts block: "loading chart" and a pending button until it has drawn. */
export function useChartCard(
  chartRef: RefObject<EChartsType | null>,
  ready: boolean,
  theme: Theme,
  pixelRatio = 2,
): Pick<BlockCardProps, 'fullScreen' | 'state'> {
  const ownerKey = useId()
  const { open } = useDiagramViewer()

  const openChart = useCallback(() => {
    const chart = chartRef.current
    if (!chart) return
    const dataUrl = chart.getDataURL({ pixelRatio, backgroundColor: chartPalette(theme).card })
    open(ownerKey, <img src={dataUrl} alt="chart" className="max-w-full" />)
  }, [chartRef, theme, pixelRatio, open, ownerKey])

  return ready ? { fullScreen: openChart } : { fullScreen: 'pending', state: LOADING.chart }
}
