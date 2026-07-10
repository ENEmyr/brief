'use client'
import { useState } from 'react'
import type { EChartsOption } from 'echarts'
import type { Block } from '@brief/schema'
import { DiagramCard } from '../DiagramCard'
import { ChartExpandButton } from './ChartExpandButton'
import { useTheme } from '@/features/theme'
import { AXIS_FONT, PALETTES, seriesColors, useEChart } from '../../services/echarts'
import type { Palette } from '../../services/echarts'

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

export function buildBigOOption(block: BigOBlockType, n: number, palette: Palette): EChartsOption {
  const maxN = block.maxN ?? DEFAULT_MAX_N
  const xs = sampleNs(maxN)
  const colors = seriesColors(palette)

  return {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.card,
      textStyle: { color: palette.text, fontFamily: AXIS_FONT, fontSize: 11 },
      borderColor: palette.line2,
    },
    grid: { top: 16, bottom: 34, left: 44, right: 16, containLabel: true },
    xAxis: {
      type: 'value',
      name: 'n',
      nameTextStyle: { color: palette.sub, fontFamily: AXIS_FONT, fontSize: 10 },
      axisLabel: { color: palette.sub, fontFamily: AXIS_FONT, fontSize: 10 },
      axisLine: { lineStyle: { color: palette.sub } },
      splitLine: { lineStyle: { color: palette.line2 } },
    },
    yAxis: {
      type: 'log',
      name: 'ops',
      nameTextStyle: { color: palette.sub, fontFamily: AXIS_FONT, fontSize: 10 },
      axisLabel: { color: palette.sub, fontFamily: AXIS_FONT, fontSize: 10 },
      axisLine: { lineStyle: { color: palette.sub } },
      splitLine: { lineStyle: { color: palette.line2 } },
    },
    series: block.series.map((s, i) => {
      const fn = CURVE_FNS[s.curve]
      const capped = isCapped(s.curve, maxN)
      const name = capped ? `${s.label} (capped at n=30)` : s.label
      return {
        name,
        type: 'line',
        showSymbol: false,
        smooth: false,
        color: colors[i % colors.length],
        data: xs.map((x): [number, number] => [x, fn(x)]),
        ...(i === 0
          ? {
              markLine: {
                silent: true,
                symbol: 'none',
                animation: false,
                label: { show: false },
                lineStyle: { color: palette.mauve, type: 'dashed' },
                data: [{ xAxis: n }],
              },
            }
          : {}),
      }
    }),
  }
}

export function BigO({ block }: { block: BigOBlockType }) {
  const { theme } = useTheme()
  const palette = PALETTES[theme]
  const maxN = block.maxN ?? DEFAULT_MAX_N
  // v=100 -> n=maxN (see sliderToN), matching "initial n = maxN" from the brief.
  const [v, setV] = useState(100)
  const n = sliderToN(v, maxN)

  const { containerRef, chartRef } = useEChart(() => buildBigOOption(block, n, palette), [block, n, theme])

  const controls = (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={1}
          max={100}
          value={v}
          onChange={(event) => setV(Number(event.target.value))}
          aria-label="n (log scale)"
          className="w-full accent-mauve"
        />
        <ChartExpandButton chartRef={chartRef} palette={palette} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] text-sub">
        <span>
          n = <b className="text-text">{n.toLocaleString()}</b>
        </span>
        {block.series.map((s) => {
          const capped = isCapped(s.curve, maxN)
          const ops = CURVE_FNS[s.curve](n)
          return (
            <span key={s.label}>
              {s.label} ({CURVE_LABELS[s.curve]}) ≈{' '}
              <b className="text-mauve">
                {fmt(ops)}
                {capped ? ' (capped)' : ''}
              </b>
            </span>
          )
        })}
      </div>
    </div>
  )

  return (
    <DiagramCard caption={block.title ?? 'Big-O comparison'} expandable={false} controls={controls}>
      <div ref={containerRef} className="h-[260px] w-full" />
    </DiagramCard>
  )
}
