'use client'
import { useState } from 'react'
import type { EChartsOption } from 'echarts'
import type { Block } from '@brief/schema'
import { BIGO_CURVES } from '@brief/schema'
import { BlockCard, cardHeader } from '../BlockCard'
import type { BlockAnchor } from '../blockAnchor'
import { useChartCard } from '../fullScreen'
import { useTheme } from '@/features/theme'
import { chartPalette, chartTooltip, useEChart } from '../../services/echarts'
import type { Palette } from '../../services/echarts'
import { DiagramFooter } from './diagramParts'

type BigOBlockType = Extract<Block, { type: 'bigo' }>
type BigOCurve = BigOBlockType['series'][number]['curve']

export const DEFAULT_MAX_N = 10_000
const SAMPLE_COUNT = 60
// Curves are capped here (not just for the '2n' overflow guard) so that
// every curve function stays well-defined and finite over the sampled range.
const CURVE_FNS: Record<BigOCurve, (n: number) => number> = {
  '1': () => 1,
  logn: (n) => Math.log2(Math.max(2, n)),
  sqrt: (n) => Math.sqrt(n),
  n: (n) => n,
  nlogn: (n) => n * Math.log2(Math.max(2, n)),
  n2: (n) => n * n,
  n3: (n) => n ** 3,
  '2n': (n) => 2 ** Math.min(n, 30),
}

const CURVE_LABELS: Record<BigOCurve, string> = {
  '1': 'O(1)',
  logn: 'O(log n)',
  sqrt: 'O(√n)',
  n: 'O(n)',
  nlogn: 'O(n log n)',
  n2: 'O(n²)',
  n3: 'O(n³)',
  '2n': 'O(2ⁿ)',
}

/** True when the '2n' curve's cap-at-30 clips the visible growth for this maxN. */
export function isCapped(curve: BigOCurve, maxN: number): boolean {
  return curve === '2n' && maxN > 30
}

/**
 * 60 log-spaced integer samples from 1..maxN inclusive, deduped (small
 * maxN values produce fewer than 60 distinct integers once rounded).
 */
export function sampleNs(maxN: number): number[] {
  const safeMaxN = Math.max(1, maxN)
  const samples = new Set<number>()
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const t = i / (SAMPLE_COUNT - 1)
    const value = Math.round(safeMaxN ** t)
    samples.add(Math.max(1, value))
  }
  return Array.from(samples).sort((a, b) => a - b)
}

/** Slider value v (1..100) -> n on a log scale from 1..maxN. */
export function sliderToN(v: number, maxN: number): number {
  const safeMaxN = Math.max(1, maxN)
  return Math.max(1, Math.round(safeMaxN ** (v / 100)))
}

/** >=1e9 B, >=1e6 M, >=1e3 k, else the raw value — always 1 decimal place. */
export function fmt(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}k`
  return value.toFixed(1)
}

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹'

/** "10⁶" for a power of ten from 100 up, else the plain number (B-Blocks:136). */
export function tickLabel(n: number): string {
  const exp = Math.log10(n)
  if (n >= 100 && Number.isInteger(exp)) return `10${[...String(exp)].map((d) => SUPERSCRIPT[Number(d)]).join('')}`
  return n.toLocaleString('en-US')
}

/**
 * B-Blocks:132-135 colors the curves by how fast they grow: the slowest lime,
 * the fastest red, the ones between amber, then the other data hues.
 */
export function curveColors(series: BigOBlockType['series'], palette: Palette): string[] {
  const ranks = [...new Set(series.map((s) => BIGO_CURVES.indexOf(s.curve)))].sort((a, b) => a - b)
  const middle = [palette.warn, palette.dataOrange, palette.info, palette.dataTeal]
  return series.map((s) => {
    const rank = ranks.indexOf(BIGO_CURVES.indexOf(s.curve))
    if (rank === 0) return palette.accentLine
    if (rank === ranks.length - 1) return palette.bad
    return middle[(rank - 1) % middle.length] ?? palette.warn
  })
}

/**
 * B-Blocks:129-136: log-log axes, horizontal grid lines, a line2 baseline, the
 * curve name at the end of each line in its color, and only the first and
 * last n under the axis. The plot leaves the right fifth for the end labels
 * (430 of 540).
 */
export function buildBigOOption(block: BigOBlockType, n: number, palette: Palette): EChartsOption {
  const maxN = block.maxN ?? DEFAULT_MAX_N
  const xs = sampleNs(maxN)
  const colors = curveColors(block.series, palette)
  const tick = { color: palette.faint, fontFamily: palette.font, fontSize: 10 }

  return {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: { ...chartTooltip(palette), trigger: 'axis' },
    grid: { top: 16, bottom: 30, left: '5.6%', right: '20.4%' },
    xAxis: {
      type: 'log',
      min: xs[0] ?? 1,
      max: maxN,
      axisLine: { lineStyle: { color: palette.line2 } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { ...tick, customValues: [xs[0] ?? 1, maxN], formatter: (value: number) => tickLabel(value) },
    },
    yAxis: {
      type: 'log',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: palette.gridLine } },
    },
    series: block.series.map((s, i) => {
      const fn = CURVE_FNS[s.curve]
      const capped = isCapped(s.curve, maxN)
      const name = capped ? `${s.label} (capped at n=30)` : s.label
      const color = colors[i] ?? palette.accentLine
      return {
        name,
        type: 'line',
        showSymbol: false,
        smooth: false,
        color,
        lineStyle: { width: 2 },
        endLabel: { show: true, formatter: s.label, color, fontFamily: palette.font, fontSize: 11, distance: 8 },
        data: xs.map((x): [number, number] => [x, fn(x)]),
        ...(i === 0
          ? {
              markLine: {
                silent: true,
                symbol: 'none',
                animation: false,
                label: { show: false },
                lineStyle: { color: palette.faint, type: 'dashed', width: 1.5 },
                data: [{ xAxis: n }],
              },
            }
          : {}),
      }
    }),
  }
}

export function BigO({ block, ...anchor }: { block: BigOBlockType } & BlockAnchor) {
  const { theme } = useTheme()
  const maxN = block.maxN ?? DEFAULT_MAX_N
  // v=100 -> n=maxN (see sliderToN), matching "initial n = maxN" from the brief.
  const [v, setV] = useState(100)
  const n = sliderToN(v, maxN)

  const { containerRef, chartRef, ready, failed } = useEChart(
    () => buildBigOOption(block, n, chartPalette(theme)),
    [block, n, theme],
  )
  const chartCard = useChartCard(chartRef, ready, theme, 2, failed, {
    heading: { kind: block.type, title: block.title },
  })

  return (
    <BlockCard {...cardHeader(block, anchor)} meta={failed ? undefined : <span className="shrink-0">log scale</span>} {...chartCard}>
      <div className="p-3">
        <div ref={containerRef} className={`aspect-[540/200] w-full rounded-[4px] ${ready ? '' : 'sk'}`} />
      </div>
      {/* The n slider (owner ruling D5); no board draws it, so it sits in the footer row. */}
      <DiagramFooter>
        <label className="flex min-w-0 flex-1 items-center gap-2 font-mono">
          n
          <input
            type="range"
            min={1}
            max={100}
            value={v}
            onChange={(event) => setV(Number(event.target.value))}
            aria-label="n (log scale)"
            className="min-w-0 flex-1 accent-accent max-[880px]:min-h-11"
          />
          <b className="text-text">{n.toLocaleString()}</b>
        </label>
        <span className="flex flex-wrap gap-x-4 gap-y-1 font-mono">
          {block.series.map((s) => (
            <span key={s.label}>
              {s.label === CURVE_LABELS[s.curve] ? s.label : `${s.label} (${CURVE_LABELS[s.curve]})`} ≈{' '}
              <b className="text-text">
                {fmt(CURVE_FNS[s.curve](n))}
                {isCapped(s.curve, maxN) ? ' (capped)' : ''}
              </b>
            </span>
          ))}
        </span>
      </DiagramFooter>
    </BlockCard>
  )
}
