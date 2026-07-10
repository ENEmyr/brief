'use client'
import { useCallback } from 'react'
import type { RefObject } from 'react'
import type { EChartsType } from 'echarts/core'
import { useDiagramViewer } from '@/features/diagram-viewer'
import type { Palette } from '../../services/echarts'

export interface ChartExpandButtonProps {
  chartRef: RefObject<EChartsType | null>
  palette: Palette
  /**
   * Capture scale for `chart.getDataURL`. Defaults to 2 (crisper capture for
   * the canvas-rendered 2D charts). Plot3d must pass 1: echarts-gl cannot
   * upscale its WebGL layer during capture, so any pixelRatio > 1 serializes
   * an empty GL layer (blank chart, only the 2D visualMap bar survives) —
   * verified empirically in a real browser.
   */
  pixelRatio?: number
}

/**
 * Shared Expand control for the four canvas-rendered echarts blocks.
 * DiagramCard's own Expand button only serializes an inline `svg` or
 * `[data-expand-root]` element found in its body (see
 * DiagramCard.handleExpand) — echarts renders to a `<canvas>`, which has no
 * DOM markup to serialize. Chart blocks therefore pass `expandable={false}`
 * to DiagramCard and render this button in their controls row instead,
 * serializing the live chart via `chart.getDataURL(...)` into an `<img>` tag
 * string handed to the same shared diagram-viewer overlay.
 *
 * One shared component so the expand wiring isn't duplicated across
 * BigO/Heatmap/Histogram/Scatter.
 */
export function ChartExpandButton({ chartRef, palette, pixelRatio = 2 }: ChartExpandButtonProps) {
  const { open } = useDiagramViewer()

  const onExpand = useCallback(() => {
    const chart = chartRef.current
    if (!chart) return
    const dataUrl = chart.getDataURL({ pixelRatio, backgroundColor: palette.card })
    open(`<img src="${dataUrl}" alt="chart" />`)
  }, [chartRef, palette, pixelRatio, open])

  return (
    <button
      type="button"
      aria-label="Expand chart"
      onClick={onExpand}
      className="relative rounded-md border border-line bg-card px-[9px] py-[3px] font-mono text-[10.5px] text-mauve before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
    >
      ⤢ Expand
    </button>
  )
}
