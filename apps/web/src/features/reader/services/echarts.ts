'use client'
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { EChartsType } from 'echarts/core'
import type { EChartsOption } from 'echarts'
import { beginThemedRender } from '@/features/theme'

export interface Palette {
  text: string
  sub: string
  line2: string
  mauve: string
  blue: string
  green: string
  red: string
  peach: string
  teal: string
  yellow: string
  card: string
}

// Literal Catppuccin hex values, same posture as MermaidBlock's THEME_VARIABLES
// map: echarts renders to <canvas>, not styled DOM, so charts re-theme by
// rebuilding their option from this map (callers must include `theme` in
// useEChart's deps) rather than reading CSS custom properties.
export const PALETTES: Record<'latte' | 'mocha', Palette> = {
  latte: {
    text: '#4c4f69',
    sub: '#6c6f85',
    line2: '#e6e9ef',
    mauve: '#8839ef',
    blue: '#1e66f5',
    green: '#40a02b',
    red: '#d20f39',
    peach: '#fe640b',
    teal: '#179299',
    yellow: '#df8e1d',
    card: '#ffffff',
  },
  mocha: {
    text: '#cdd6f4',
    sub: '#a6adc8',
    line2: '#292a3a',
    mauve: '#cba6f7',
    blue: '#89b4fa',
    green: '#a6e3a1',
    red: '#f38ba8',
    peach: '#fab387',
    teal: '#94e2d5',
    yellow: '#f9e2af',
    card: '#1e1e2e',
  },
}

export const AXIS_FONT = "'IBM Plex Mono', monospace"

/** Series palette cycling order shared by every chart block. */
export function seriesColors(palette: Palette): string[] {
  return [palette.mauve, palette.blue, palette.green, palette.peach, palette.teal, palette.red, palette.yellow]
}

// Lazy singleton: echarts/core plus only the charts/components this app's
// four chart blocks actually use must never land in the app's first-load JS.
// Each import(...) below is a dynamic import inside a function body, which
// Next's bundler always splits into its own async chunk — same posture as
// services/shiki.ts's highlighter singleton and MermaidBlock/MathBlock's
// lazy library imports. echarts.use([...]) runs exactly once.
let echartsPromise: Promise<typeof import('echarts/core')> | null = null

export async function getECharts(): Promise<typeof import('echarts/core')> {
  echartsPromise ??= (async () => {
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
  })()
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
  echartsGLPromise ??= getECharts().then(async (ec) => {
    await import('echarts-gl')
    return ec
  })
  return echartsGLPromise
}

export interface UseEChartResult {
  containerRef: RefObject<HTMLDivElement | null>
  chartRef: RefObject<EChartsType | null>
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

  return { containerRef, chartRef }
}
