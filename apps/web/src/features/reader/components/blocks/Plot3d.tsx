'use client'
import { useRef } from 'react'
import type { EChartsOption } from 'echarts'
import type { Block } from '@brief/schema'
import { BlockCard, cardHeader } from '../BlockCard'
import type { BlockAnchor } from '../blockAnchor'
import { useChartCard } from '../fullScreen'
import { FOCUS_RING } from '../topbarChrome'
import { useTheme } from '@/features/theme'
import { chartPalette, chartTooltip, useEChart, getEChartsGL } from '../../services/echarts'
import type { Palette } from '../../services/echarts'

type Plot3dBlockType = Extract<Block, { type: 'plot3d' }>

/** grid[row][col] -> [x=col idx, y=row idx, z=value] triples, echarts-gl's data-based surface format. */
function gridToTriples(grid: number[][]): [number, number, number][] {
  const triples: [number, number, number][] = []
  grid.forEach((row, y) => {
    row.forEach((value, x) => {
      triples.push([x, y, value])
    })
  })
  return triples
}

/** B-Blocks2:170-180: line2 axes, plot3d-grid rules, the axis names in mono 11 faint. */
function axis3D(name: string | undefined, palette: Palette) {
  return {
    name,
    nameTextStyle: { color: palette.faint, fontFamily: palette.font, fontSize: 11 },
    axisLabel: { color: palette.faint, fontFamily: palette.font, fontSize: 10 },
    axisLine: { lineStyle: { color: palette.line2 } },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: palette.plot3dGrid } },
  }
}

/**
 * A surface the way B-Blocks2:170-177 draws it: no fill, a line along each
 * grid row in the height ramp, and the cross lines in the plot3d grid color.
 * The surface itself stays, transparent, so hovering anywhere on it still reads
 * out x, y and z (B-Blocks2:188): a line3D picks its hover point by x alone.
 */
function surfaceSeries(grid: number[][], data: [number, number, number][], palette: Palette) {
  const rows = grid.map((row, y) => ({ type: 'line3D', data: row.map((z, x) => [x, y, z]), lineStyle: { width: 1 } }))
  const columns = Array.from({ length: Math.max(0, ...grid.map((row) => row.length)) }, (_, x) => ({
    type: 'line3D',
    silent: true,
    data: grid.flatMap((row, y) => (x < row.length ? [[x, y, row[x]]] : [])),
    lineStyle: { width: 1, color: palette.plot3dGrid },
  }))
  const hover = { type: 'surface', name: 'surface', data, shading: 'color', itemStyle: { opacity: 0 }, wireframe: { show: false } }
  return { series: [...rows, ...columns, hover], ramped: rows.map((_, i) => i) }
}

/** echarts-gl's own starting camera distance; the zoom buttons move from here. */
const DEFAULT_DISTANCE = 200
/** One zoom press, as the viewer's 25-point step reads at 100%. */
const ZOOM_FACTOR = 1.25

/**
 * Option builder for both plot3d kinds. `scatter3d` maps `block.points`
 * straight into a `scatter3D` series; `surface` flattens `block.grid` (a z
 * matrix) into [x,y,z] triples for echarts-gl's data-based `surface` series.
 * Height maps to the single-hue lime ramp of B-Blocks2:172-176 through a
 * hidden continuous visualMap over z, the surface carries plot3d-grid
 * wireframe lines (B-Blocks2:177), and the camera only moves when the reader
 * moves it.
 *
 * Returns `EChartsOption` through an `unknown` cast: the GL-only keys
 * (`xAxis3D`, `grid3D`, `surface`, ...) are not part of that type.
 */
export function buildPlot3dOption(block: Plot3dBlockType, palette: Palette): EChartsOption {
  const data: [number, number, number][] =
    block.kind === 'surface' ? gridToTriples(block.grid ?? []) : (block.points ?? [])

  const zValues = data.map((point) => point[2])
  const min = zValues.length ? Math.min(...zValues) : 0
  const dataMax = zValues.length ? Math.max(...zValues) : 1
  // Degenerate all-equal-z datasets get max+1 so the visualMap range never
  // collapses to zero width — same rule Heatmap's builder uses.
  const max = dataMax === min ? dataMax + 1 : dataMax
  const surface = block.kind === 'surface' ? surfaceSeries(block.grid ?? [], data, palette) : null

  const option: Record<string, unknown> = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: chartTooltip(palette),
    visualMap: {
      dimension: 2,
      min,
      max,
      show: false,
      inRange: { color: [...palette.plot3d] },
      ...(surface ? { seriesIndex: surface.ramped } : {}),
    },
    xAxis3D: axis3D(block.xLabel, palette),
    yAxis3D: axis3D(block.yLabel, palette),
    zAxis3D: axis3D(block.zLabel, palette),
    grid3D: {
      viewControl: { autoRotate: false, distance: DEFAULT_DISTANCE },
    },
    series: surface ? surface.series : [{ type: 'scatter3D', data, symbolSize: 6 }],
  }

  return option as unknown as EChartsOption
}

// Probed once per module lifetime and cached — WebGL support cannot change
// within a session, and a fresh `<canvas>` + getContext() call on every
// render is wasted work (this component re-renders on every theme toggle).
let webglSupport: boolean | null = null

function hasWebGL(): boolean {
  if (webglSupport === null) {
    webglSupport = !!document.createElement('canvas').getContext('webgl')
  }
  return webglSupport
}

/**
 * Test-only escape hatch: plot3d.test.tsx exercises both the no-WebGL and
 * WebGL-available paths by mocking `HTMLCanvasElement.prototype.getContext`
 * differently across cases, but the module-level cache above only probes
 * once per module lifetime. Exported solely so the test file can force a
 * re-probe between cases; production code never calls this.
 */
export function __resetWebGLCacheForTests(): void {
  webglSupport = null
}

function hasData(block: Plot3dBlockType): boolean {
  return block.kind === 'surface' ? !!block.grid?.length : !!block.points?.length
}

const CONTROL = `flex shrink-0 items-center justify-center rounded-[4px] border border-line2 bg-elev text-text transition-[background-color,transform] duration-[var(--dur-fast)] hover:bg-chip active:scale-[.97] motion-reduce:transition-none ${FOCUS_RING}`

export function Plot3d({ block, ...anchor }: { block: Plot3dBlockType } & BlockAnchor) {
  const { theme } = useTheme()
  const distance = useRef(DEFAULT_DISTANCE)

  const webGLAvailable = hasWebGL()
  const dataAvailable = hasData(block)
  const canRender = webGLAvailable && dataAvailable

  // Hook is always called (rules of hooks) — when canRender is false the
  // container div below never mounts, so useEChart's effect finds
  // `containerRef.current` null and never initializes a chart instance.
  const { containerRef, chartRef, ready, failed } = useEChart(
    () => buildPlot3dOption(block, chartPalette(theme)),
    [block, theme],
    getEChartsGL,
  )
  // pixelRatio 1: echarts-gl's WebGL layer captures blank at pixelRatio > 1
  const chartCard = useChartCard(chartRef, ready, theme, 1, failed, {
    heading: { kind: block.type, title: block.title },
  })

  function zoom(factor: number) {
    distance.current = Math.min(400, Math.max(40, distance.current * factor))
    chartRef.current?.setOption({ grid3D: { viewControl: { distance: distance.current } } } as unknown as EChartsOption)
  }

  function resetView() {
    distance.current = DEFAULT_DISTANCE
    chartRef.current?.setOption(buildPlot3dOption(block, chartPalette(theme)), true)
  }

  if (!canRender) {
    // Nothing can be drawn: the B-States error card, with the block as data.
    return (
      <BlockCard
        {...cardHeader(block, anchor)}
        captionPrefix={block.kind}
        state={{
          status: 'error',
          message: webGLAvailable ? 'No data for 3D plot' : 'WebGL unavailable - 3D plot cannot render',
          raw: block,
        }}
      />
    )
  }

  return (
    <BlockCard
      {...cardHeader(block, anchor)}
      captionPrefix={block.kind}
      controls={
        <button
          type="button"
          aria-label="Reset view"
          disabled={!ready}
          onClick={resetView}
          className={`${CONTROL} min-h-8 px-2.5 text-[11px] disabled:opacity-45 max-[880px]:min-h-11`}
        >
          reset view
        </button>
      }
      {...chartCard}
    >
      <div className="relative bg-[var(--c-code-bg)] p-4">
        <div ref={containerRef} className={`aspect-[680/300] w-full rounded-[4px] ${ready ? '' : 'sk'}`} />
        {ready ? (
          <div className="absolute bottom-6 left-7 flex gap-1.5">
            <button type="button" aria-label="Zoom in" onClick={() => zoom(1 / ZOOM_FACTOR)} className={`${CONTROL} size-9 text-[16px] max-[880px]:size-11`}>
              +
            </button>
            <button type="button" aria-label="Zoom out" onClick={() => zoom(ZOOM_FACTOR)} className={`${CONTROL} size-9 text-[16px] max-[880px]:size-11`}>
              −
            </button>
          </div>
        ) : null}
      </div>
    </BlockCard>
  )
}
