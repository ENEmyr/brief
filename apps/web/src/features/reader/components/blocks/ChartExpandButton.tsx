'use client'
import { useCallback, useId } from 'react'
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
 * Shared Expand control for the four canvas-rendered echarts blocks. Echarts
 * renders to a `<canvas>`, so unlike the SVG diagrams there is no live node to
 * hand the viewer. Chart blocks pass `expandable={false}` to DiagramCard and
 * render this button in their controls row instead, capturing the chart via
 * `chart.getDataURL(...)` into an `<img>` handed to the same shared overlay.
 *
 * One shared component so the expand wiring isn't duplicated across
 * BigO/Heatmap/Histogram/Scatter.
 */
export function ChartExpandButton({ chartRef, palette, pixelRatio = 2 }: ChartExpandButtonProps) {
  const ownerKey = useId()
  const { open } = useDiagramViewer()

  const onExpand = useCallback(() => {
    const chart = chartRef.current
    if (!chart) return
    const dataUrl = chart.getDataURL({ pixelRatio, backgroundColor: palette.card })
    // A React element, not an HTML string: the viewer renders it directly, so
    // the data URL never round-trips through an HTML sink.
    open(ownerKey, <img src={dataUrl} alt="chart" className="max-w-full" />)
  }, [chartRef, palette, pixelRatio, open, ownerKey])

  return (
    <button
      type="button"
      aria-label="Expand chart"
      onClick={onExpand}
      className="relative rounded-md border border-line bg-card px-[9px] py-[3px] font-mono text-[10.5px] text-mauve transition-colors hover:border-mauve hover:bg-mauvesoft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mauve before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
    >
      ⤢ Expand
    </button>
  )
}
