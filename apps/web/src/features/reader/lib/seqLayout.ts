/**
 * Geometry for the sequence diagram block.
 *
 * The old layout was fixed: a 480-unit viewBox, actors spread over a 340-unit
 * span whatever their number or their name length, an 80-unit actor pill, one
 * unwrapped line per label, and a 30-unit row pitch. Rendered at `width: 100%`
 * in the reader's ~870px column that 480-unit box was a ~1.8x upscale, so an
 * 11-unit label painted larger than body copy, while long labels and long actor
 * names ran straight out of their boxes.
 *
 * Here every number comes from the content: pills are sized to their name,
 * lanes to the widest pill, the diagram width to the lanes, and the row pitch
 * to the number of wrapped lines a label needs. The caller renders the result at
 * its natural size, so it can only ever be scaled down to fit the column.
 */
import type { Block } from '@brief/schema'
import { estimateTextWidth, widestLine, wrapText } from './svgText'

type SeqBlock = Extract<Block, { type: 'seq' }>
type SeqStep = SeqBlock['steps'][number]

export const ACTOR_FONT_SIZE = 11.5
export const LABEL_FONT_SIZE = 11
export const LINE_HEIGHT = 13
export const PILL_HEIGHT = 24
export const PILL_Y = 6
export const SELF_LOOP_WIDTH = 26

const PILL_PAD_X = 10
const PILL_MIN_WIDTH = 56
const LANE_GAP = 18
const LANE_MIN = 110
const LANE_MAX = 190
/**
 * Lanes only need to grow with the labels up to a point: a wider diagram is
 * downscaled harder by the column, which shrinks the text again. Wrapping onto
 * a fourth line is cheaper than losing a quarter of the font size, so the label
 * contribution to the lane is a quarter of the longest label.
 */
const LANE_LABEL_SHARE = 0.25
const MARGIN = 14
const ROW_GAP = 8
const SELF_LABEL_OFFSET = 32
const LABEL_INSET = 14
const SELF_LABEL_MIN_WIDTH = 90
/**
 * A self-message owns its whole row, so its label may run past the next
 * lifeline. Giving it a single lane's tail would stack a long Thai sentence
 * into six lines; two lanes keeps it to two or three.
 */
const SELF_LABEL_LANES = 2
/** Gap between the bottom label baseline and the arrow it sits on. */
const BASELINE_LIFT = 6
const ASCENT = 10

export interface SeqActorLayout {
  name: string
  x: number
  pillWidth: number
}

export interface SeqStepLayout {
  self: boolean
  x1: number
  x2: number
  y: number
  lines: string[]
  labelX: number
  /** Baseline of the first line; later lines advance by LINE_HEIGHT. */
  labelY: number
  centered: boolean
}

export interface SeqLayout {
  width: number
  height: number
  lifelineBottom: number
  actors: SeqActorLayout[]
  steps: SeqStepLayout[]
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function pillWidth(name: string): number {
  return Math.max(PILL_MIN_WIDTH, estimateTextWidth(name, ACTOR_FONT_SIZE) + 2 * PILL_PAD_X)
}

function laneWidth(pills: number[], steps: SeqStep[]): number {
  const widestPill = pills.reduce((w, p) => Math.max(w, p), 0)
  const longestLabel = steps.reduce((w, s) => Math.max(w, estimateTextWidth(s.label, LABEL_FONT_SIZE)), 0)
  return clamp(Math.max(widestPill + LANE_GAP, longestLabel * LANE_LABEL_SHARE), LANE_MIN, LANE_MAX)
}

export function computeSeqLayout(actorNames: string[], steps: SeqStep[]): SeqLayout {
  const pills = actorNames.map(pillWidth)
  const lane = laneWidth(pills, steps)
  const left = MARGIN + (pills[0] ?? PILL_MIN_WIDTH) / 2

  const actors: SeqActorLayout[] = actorNames.map((name, i) => ({
    name,
    x: left + i * lane,
    pillWidth: pills[i] ?? PILL_MIN_WIDTH,
  }))

  const indexOf = new Map(actorNames.map((a, i) => [a, i]))
  let cursor = PILL_Y + PILL_HEIGHT + 12
  let rightEdge = actors.reduce((r, a) => Math.max(r, a.x + a.pillWidth / 2), 0)

  const laid: SeqStepLayout[] = steps.map((s) => {
    const from = actors[indexOf.get(s.from) ?? 0]
    const to = actors[indexOf.get(s.to) ?? 0]
    const x1 = from?.x ?? left
    const x2 = to?.x ?? left
    const self = s.from === s.to

    if (self) {
      const room = Math.max(SELF_LABEL_MIN_WIDTH, SELF_LABEL_LANES * lane - SELF_LABEL_OFFSET - LABEL_INSET)
      const lines = wrapText(s.label, room, LABEL_FONT_SIZE)
      const stack = (lines.length - 1) * LINE_HEIGHT
      const half = Math.max(12, stack / 2 + 8)
      const y = cursor + half
      const labelX = x1 + SELF_LABEL_OFFSET
      cursor = y + half + ROW_GAP
      rightEdge = Math.max(rightEdge, labelX + widestLine(lines, LABEL_FONT_SIZE))
      return { self, x1, x2, y, lines, labelX, labelY: y - stack / 2 + 4, centered: false }
    }

    const span = Math.max(1, Math.abs((indexOf.get(s.to) ?? 0) - (indexOf.get(s.from) ?? 0)))
    const lines = wrapText(s.label, span * lane - LABEL_INSET, LABEL_FONT_SIZE)
    const stack = (lines.length - 1) * LINE_HEIGHT
    const y = cursor + stack + BASELINE_LIFT + ASCENT
    cursor = y + 4 + ROW_GAP
    return {
      self,
      x1,
      x2,
      y,
      lines,
      labelX: (x1 + x2) / 2,
      labelY: y - BASELINE_LIFT - stack,
      centered: true,
    }
  })

  const height = Math.max(cursor - ROW_GAP, PILL_Y + PILL_HEIGHT + 30) + 12
  return {
    width: Math.round(rightEdge + MARGIN),
    height: Math.round(height),
    lifelineBottom: Math.round(height) - 10,
    actors,
    steps: laid,
  }
}
