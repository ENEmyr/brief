'use client'
import { useCallback, useEffect, useId } from 'react'
import type { ReactNode, RefObject } from 'react'
import type { EChartsType } from 'echarts/core'
import { useDiagramViewer, type ViewerExtras } from '@/features/diagram-viewer'
import type { Theme } from '@/features/theme'
import { chartPalette } from '../services/echarts'
import { LOADING, type BlockCardProps } from './BlockCard'

/** `extras` carries the viewer's header (kind tag, title) and, for a stepped diagram, its steps. */
export function useDiagramFullScreen(node: ReactNode, extras?: ViewerExtras): () => void {
  const ownerKey = useId()
  const { expandedKey, open, sync } = useDiagramViewer()
  const isExpanded = expandedKey === ownerKey

  useEffect(() => {
    if (isExpanded) sync(ownerKey, node, extras)
  }, [isExpanded, sync, ownerKey, node, extras])

  return () => open(ownerKey, node, extras)
}

/**
 * The card props of an echarts block: "loading chart" and a pending button
 * until it has drawn, and the B-States error card if echarts never arrives.
 */
export function useChartCard(
  chartRef: RefObject<EChartsType | null>,
  ready: boolean,
  theme: Theme,
  pixelRatio = 2,
  failed = false,
  extras?: ViewerExtras,
  overlay?: ReactNode,
): Pick<BlockCardProps, 'fullScreen' | 'state'> {
  const ownerKey = useId()
  const { open } = useDiagramViewer()

  const openChart = useCallback(() => {
    const chart = chartRef.current
    if (!chart) return
    const dataUrl = chart.getDataURL({ pixelRatio, backgroundColor: chartPalette(theme).card })
    // Drawn at the chart's own size (the capture has pixelRatio times the
    // pixels), and sized before it decodes so the viewer can fit it on open.
    // `overlay` is HTML drawn over the plot in the card (a threshold line), which the canvas capture lacks.
    open(
      ownerKey,
      <div className="relative" style={{ width: chart.getWidth() }}>
        <img src={dataUrl} alt="chart" width={chart.getWidth()} height={chart.getHeight()} className="block" />
        {overlay}
      </div>,
      extras,
    )
  }, [chartRef, theme, pixelRatio, open, ownerKey, extras, overlay])

  if (failed) return { state: { status: 'error', message: 'Chart could not be drawn.' } }
  return ready ? { fullScreen: openChart } : { fullScreen: 'pending', state: LOADING.chart }
}
