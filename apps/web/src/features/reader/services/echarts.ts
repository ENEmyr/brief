'use client'
import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { EChartsType } from 'echarts/core'
import type { EChartsOption } from 'echarts'
import { beginThemedRender, readColorTokens, readFontStack } from '@/features/theme'
import type { Theme } from '@/features/theme'

export interface Palette {
  text: string
  sub: string
  faint: string
  line2: string
  card: string
  page: string
  gridLine: string
  accent: string
  accentText: string
  accentLine: string
  info: string
  good: string
  warn: string
  bad: string
  dataOrange: string
  dataTeal: string
  /** Heatmap ramp, low to high (B-Blocks:181-184). */
  heat: [string, string, string, string, string]
  /** plot3d height ramp, low to high (B-Blocks2:172-176). */
  plot3d: [string, string, string, string, string]
  plot3dGrid: string
  font: string
  sans: string
}

const PALETTE_TOKENS = [
  'text',
  'sub',
  'faint',
  'line2',
  'card',
  'page',
  'elev',
  'grid-line',
  'accent',
  'accent-text',
  'accent-line',
  'info',
  'good',
  'warn',
  'bad',
  'data-orange',
  'data-teal',
  'heat-1',
  'heat-2',
  'heat-3',
  'plot3d-1',
  'plot3d-2',
  'plot3d-3',
  'plot3d-4',
  'plot3d-grid',
] as const

/**
 * The chart palette for `theme`, read from the globals.css tokens: echarts
 * renders to <canvas>, not styled DOM, so it needs resolved values, not
 * var(). Charts re-theme by rebuilding their option (callers must include
 * `theme` in useEChart's deps). Call it inside buildOption or an event
 * handler, never during render.
 */
export function chartPalette(theme: Theme): Palette {
  const c = readColorTokens(theme, PALETTE_TOKENS)
  return {
    text: c.text,
    sub: c.sub,
    faint: c.faint,
    line2: c.line2,
    card: c.card,
    page: c.page,
    gridLine: c['grid-line'],
    accent: c.accent,
    accentText: c['accent-text'],
    accentLine: c['accent-line'],
    info: c.info,
    good: c.good,
    warn: c.warn,
    bad: c.bad,
    dataOrange: c['data-orange'],
    dataTeal: c['data-teal'],
    heat: [c.elev, c['heat-1'], c['heat-2'], c['heat-3'], c.accent],
    plot3d: [c['plot3d-1'], c['plot3d-2'], c['plot3d-3'], c['plot3d-4'], c['accent-line']],
    plot3dGrid: c['plot3d-grid'],
    font: readFontStack('mono'),
    sans: readFontStack('sans'),
  }
}

/**
 * Series order for charts with several series: red and lime first, as
 * B-Blocks2:151-157 draws "before" and "after", then the other data hues.
 */
export function seriesColors(palette: Palette): string[] {
  return [palette.bad, palette.accentLine, palette.info, palette.warn, palette.dataOrange, palette.dataTeal, palette.good]
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/**
 * echarts writes a tooltip formatter's return value into the page as HTML, so
 * any payload text a formatter returns goes through this first. Its default
 * tooltip escapes on its own; axis and end labels draw on the canvas.
 */
export function encodeHTML(text: string): string {
  return text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c)
}

/**
 * The chart tooltip B-Blocks:186 draws: an inverted chip, text-colored fill
 * with page-colored Geist 12, radius 4, padding 6/8.
 */
export function chartTooltip(palette: Palette) {
  return {
    backgroundColor: palette.text,
    borderWidth: 0,
    padding: [6, 8],
    extraCssText: 'border-radius: 4px; box-shadow: none;',
    textStyle: { color: palette.page, fontFamily: palette.sans, fontSize: 12 },
  }
}

// Lazy singleton: echarts/core plus only the charts/components this app's
// four chart blocks actually use must never land in the app's first-load JS.
// Each import(...) below is a dynamic import inside a function body, which
// Next's bundler always splits into its own async chunk — same posture as
// services/shiki.ts's highlighter singleton and MermaidBlock/MathBlock's
// lazy library imports. echarts.use([...]) runs exactly once.
let echartsPromise: Promise<typeof import('echarts/core')> | null = null

/** A chunk that failed to load is asked for again by the next chart instead of failing from the cache. */
function forgetOnFailure<T>(promise: Promise<T>, forget: () => void): Promise<T> {
  promise.catch(forget)
  return promise
}

export async function getECharts(): Promise<typeof import('echarts/core')> {
  echartsPromise ??= forgetOnFailure(
    (async () => {
    const [echarts, chartsMod, componentsMod, renderersMod] = await Promise.all([
      import('echarts/core'),
      import('echarts/charts'),
      import('echarts/components'),
      import('echarts/renderers'),
    ])
    echarts.use([
      chartsMod.LineChart,
      chartsMod.HeatmapChart,
      chartsMod.BarChart,
      chartsMod.ScatterChart,
      componentsMod.GridComponent,
      componentsMod.TooltipComponent,
      componentsMod.VisualMapComponent,
      // MarkLineComponent isn't in the original component list this service
      // was speced with, but BigO's current-n marker line depends on it:
      // echarts/core is tree-shaken, and a `markLine` key in a series option
      // silently fails to render (no error, just missing line) unless this
      // component is registered too.
      componentsMod.MarkLineComponent,
      renderersMod.CanvasRenderer,
    ])
    return echarts
  })(),
    () => (echartsPromise = null),
  )
  return echartsPromise
}

// Lazy singleton for the plot3d block's echarts-gl extension: registers
// GL-only chart/component types (scatter3D, surface, grid3D, ...) onto the
// SAME shared echarts/core instance getECharts() resolves, via a plain
// side-effect `import('echarts-gl')` — the module has no named exports (see
// src/types/echarts-gl.d.ts). echarts-gl is ~1MB, so it must stay in its own
// async chunk, loaded only when a plot3d block actually mounts; chaining off
// getECharts() (rather than importing echarts/core again) keeps both
// singletons registering onto one shared module instance.
let echartsGLPromise: Promise<typeof import('echarts/core')> | null = null

export async function getEChartsGL(): Promise<typeof import('echarts/core')> {
  echartsGLPromise ??= forgetOnFailure(
    getECharts().then(async (ec) => {
      await import('echarts-gl')
      return ec
    }),
    () => (echartsGLPromise = null),
  )
  return echartsGLPromise
}

export interface UseEChartResult {
  containerRef: RefObject<HTMLDivElement | null>
  chartRef: RefObject<EChartsType | null>
  ready: boolean
  /** echarts never arrived, or rejected the option: the card shows the failure instead of loading forever. */
  failed: boolean
}

/**
 * Creates/owns one echarts instance on a ref'd div: mounts it once the
 * `loader` (defaults to `getECharts`) resolves (guarded by a cancelled flag —
 * see MermaidBlock/CodePre for the same pattern elsewhere in this feature),
 * calls `setOption` whenever `deps` changes, resizes via ResizeObserver, and
 * disposes on unmount. Callers MUST include `theme` in `deps` to re-theme —
 * `buildOption` is a plain closure the hook re-invokes on every deps change,
 * it does not diff the palette itself. Plot3d passes `getEChartsGL` as
 * `loader` so its GL series/components are registered before `setOption`
 * runs; every other chart block relies on the default.
 */
export function useEChart(
  buildOption: () => EChartsOption,
  deps: unknown[],
  loader: () => Promise<typeof import('echarts/core')> = getECharts,
): UseEChartResult {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<EChartsType | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Tracked so lib/print.ts can wait for this chart's redraw in the
    // print-forced palette before handing off to window.print() -- see
    // features/theme's beginThemedRender doc comment.
    const endThemedRender = beginThemedRender()
    loader()
      .then((echarts) => {
        if (cancelled || !containerRef.current) return
        chartRef.current ??= echarts.init(containerRef.current)
        chartRef.current.setOption(buildOption(), true)
        setReady(true)
        setFailed(false)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(endThemedRender)
    return () => {
      cancelled = true
    }
    // `deps` is the caller-supplied dependency list (block/n/theme); this
    // feature has no react-hooks lint plugin configured, so no
    // exhaustive-deps suppression comment is needed here.
  }, deps)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => chartRef.current?.resize())
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(
    () => () => {
      chartRef.current?.dispose()
      chartRef.current = null
    },
    [],
  )

  return { containerRef, chartRef, ready, failed }
}
