import type { ReactNode } from 'react'

/**
 * The pieces the hand-drawn diagrams (seq, state, layers, erd) share. They are
 * drawn the way the boards draw them: HTML boxes for nodes and labels, one SVG
 * layer underneath for the edges (B-Blocks:78-98, B-Blocks2:30-90).
 */

export interface Point {
  x: number
  y: number
}

/** Edge colors on the boards. Accent uses the line token, so it darkens in light. */
export const EDGE_TONE = {
  sub: 'stroke-sub fill-sub',
  faint: 'stroke-faint fill-faint',
  line2: 'stroke-line2 fill-line2',
  accent: 'stroke-accent-line fill-accent-line',
  info: 'stroke-info fill-info',
  good: 'stroke-good fill-good',
  warn: 'stroke-warn fill-warn',
  bad: 'stroke-bad fill-bad',
} as const

export type EdgeTone = keyof typeof EDGE_TONE

/** Board arrowhead: an 8px triangle, 8 wide, its tip on the target (B-Blocks:83 marker at stroke 2). */
const HEAD_LENGTH = 8
const HEAD_HALF_WIDTH = 4
/** The stroke stops inside the head, so its round cap never pokes past the tip. */
const LINE_STOP = 4

function arrowGeometry(points: Point[]): { line: string; head: string } | null {
  const tip = points[points.length - 1]
  const prev = points[points.length - 2]
  if (!tip || !prev) return null
  const length = Math.hypot(tip.x - prev.x, tip.y - prev.y) || 1
  const ux = (tip.x - prev.x) / length
  const uy = (tip.y - prev.y) / length
  const end = { x: tip.x - ux * LINE_STOP, y: tip.y - uy * LINE_STOP }
  const base = { x: tip.x - ux * HEAD_LENGTH, y: tip.y - uy * HEAD_LENGTH }
  const px = -uy * HEAD_HALF_WIDTH
  const py = ux * HEAD_HALF_WIDTH
  const line = [...points.slice(0, -1), end].map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ')
  const head = `M${tip.x} ${tip.y} L${base.x + px} ${base.y + py} L${base.x - px} ${base.y - py} Z`
  return { line, head }
}

export interface EdgeProps {
  /** From the source to the arrow tip; two points for a straight edge, more for an elbow. */
  points: Point[]
  className: string
  dashed?: boolean
  /** Lifelines and connectors without a head. */
  head?: boolean
  dataState?: string
}

/** A 2px edge with a filled head (B-Blocks:83: stroke 2, round caps and joins; dashes 6 5). */
export function Edge({ points, className, dashed = false, head = true, dataState }: EdgeProps) {
  const geometry = arrowGeometry(points)
  if (!geometry) return null
  const line = head ? geometry.line : points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ')
  return (
    <g data-edge="" data-state={dataState} className={className}>
      <path
        d={line}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? '6 5' : undefined}
      />
      {head ? <path d={geometry.head} stroke="none" /> : null}
    </g>
  )
}

/** The SVG layer under the nodes; it never takes the pointer. */
export function EdgeLayer({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
    >
      {children}
    </svg>
  )
}

/**
 * The legend and interaction hint row under a diagram (B-Blocks2:48, :93):
 * 12px `sub`, padding 8/12, a `line` rule on top.
 */
export function DiagramFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-4 border-t border-line px-3 py-2 text-[12px] text-sub [&_b]:font-bold [&_b]:text-text">
      {children}
    </div>
  )
}
