'use client'
import type { EChartsOption } from 'echarts'
import type { Block } from '@brief/schema'
import { DiagramCard } from '../DiagramCard'
import { ChartExpandButton } from './ChartExpandButton'
import { useTheme } from '@/features/theme'
import { AXIS_FONT, PALETTES, useEChart, getEChartsGL } from '../../services/echarts'
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

function axis3D(name: string | undefined, palette: Palette) {
  return {
    name,
    nameTextStyle: { color: palette.sub, fontFamily: AXIS_FONT, fontSize: 10 },
    axisLabel: { color: palette.sub, fontFamily: AXIS_FONT, fontSize: 9 },
    axisLine: { lineStyle: { color: palette.sub } },
    splitLine: { lineStyle: { color: palette.line2 } },
  }
}

/**
 * Pure option builder for both plot3d kinds. `scatter3d` maps `block.points`
 * straight into a `scatter3D` series; `surface` flattens `block.grid` (a z
 * matrix) into [x,y,z] triples via `gridToTriples` and feeds echarts-gl's
 * data-based `surface` series (no equation). Both share one continuous
 * `visualMap` over the z dimension (index 2) with a blue -> mauve gradient
 * (low -> high, this repo's mauve-accent convention), positioned horizontal
 * and bottom-centered (same as Heatmap.tsx's visualMap) so the legend sits
 * under the plot instead of ECharts' default free-floating vertical bar on
 * the far left of the card, and a `grid3D` with `viewControl.autoRotate:
 * false` so the camera only orbits on user drag.
 *
 * Returns `EChartsOption` (the full-package kitchen-sink type, same posture
 * as every other chart builder in this feature) via an `unknown` cast — the
 * GL-only option keys (`xAxis3D`/`grid3D`/`scatter3D`/`surface`/...) aren't
 * part of that type, which only knows the core+charts+components packages.
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

  const option: Record<string, unknown> = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      backgroundColor: palette.card,
      textStyle: { color: palette.text, fontFamily: AXIS_FONT, fontSize: 11 },
      borderColor: palette.line2,
    },
    visualMap: {
      dimension: 2,
      min,
      max,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      show: true,
      inRange: { color: [palette.blue, palette.mauve] },
      textStyle: { color: palette.sub, fontFamily: AXIS_FONT, fontSize: 10 },
    },
    xAxis3D: axis3D(block.xLabel, palette),
    yAxis3D: axis3D(block.yLabel, palette),
    zAxis3D: axis3D(block.zLabel, palette),
    grid3D: {
      viewControl: { autoRotate: false },
    },
    series: [
      block.kind === 'surface'
        ? { type: 'surface', data, wireframe: { show: false } }
        : { type: 'scatter3D', data, symbolSize: 6 },
    ],
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

/**
 * Note-callout-style fallback box, styled like Callout.tsx's 'note' variant
 * (same classes, inlined rather than imported since Callout doesn't export
 * its style map). Used both when WebGL is unavailable (jsdom has none, so
 * this is the natural test path) and when the block is missing the data its
 * `kind` requires (scatter3d without points, surface without grid) — in both
 * cases the chart is skipped entirely, no canvas/container is mounted.
 */
function FallbackNote({ text }: { text: string }) {
  return (
    <aside className="my-3.5 border-l-[3px] border-blue rounded-lg bg-[var(--callout-note-bg)] px-[15px] py-[11px] text-[14px] leading-[1.7] text-text">
      <p>{text}</p>
    </aside>
  )
}

export function Plot3d({ block }: { block: Plot3dBlockType }) {
  const { theme } = useTheme()
  const palette = PALETTES[theme]

  const webGLAvailable = hasWebGL()
  const dataAvailable = hasData(block)
  const canRender = webGLAvailable && dataAvailable

  // Hook is always called (rules of hooks) — when canRender is false the
  // container div below never mounts, so useEChart's effect finds
  // `containerRef.current` null and never initializes a chart instance.
  const { containerRef, chartRef } = useEChart(() => buildPlot3dOption(block, palette), [block, theme], getEChartsGL)

  return (
    <DiagramCard
      caption={block.title ?? '3D plot'}
      expandable={false}
      controls={
        canRender ? (
          <div className="flex justify-end">
            {/* pixelRatio 1: echarts-gl's WebGL layer captures blank at pixelRatio > 1 */}
            <ChartExpandButton chartRef={chartRef} palette={palette} pixelRatio={1} />
          </div>
        ) : undefined
      }
    >
      {canRender ? (
        <div ref={containerRef} className="h-[280px] w-full" />
      ) : (
        <FallbackNote
          text={webGLAvailable ? 'No data for 3D plot' : 'WebGL unavailable - 3D plot cannot render'}
        />
      )}
    </DiagramCard>
  )
}
