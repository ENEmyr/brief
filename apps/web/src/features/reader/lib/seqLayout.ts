/**
 * Geometry for the sequence diagram block, in CSS pixels, as B-Blocks:78-98
 * draws it: 130x44 actor boxes on a 160px lane, lifelines from the box bottom,
 * one message every 52px, and the label 12px above its arrow.
 *
 * Text that would not fit is wrapped against the shared width estimate, and
 * each extra line pushes its row (and every row after it) down by one line, so
 * labels never overlap. The diagram is drawn at this natural size and scrolls
 * sideways in a narrow column (B-Blocks:77 `overflow-x: auto`).
 */
import type { Block } from '@brief/schema'
import { widestLine, wrapText } from './svgText'

type SeqBlock = Extract<Block, { type: 'seq' }>
type SeqStep = SeqBlock['steps'][number]

export const ACTOR_WIDTH = 130
const ACTOR_MIN_HEIGHT = 44
const ACTOR_FONT_SIZE = 13
const LANE = 160
const ROW_PITCH = 52
const LABEL_FONT_SIZE = 12
export const LINE_HEIGHT = 16
/** Gap between a label's last line and its arrow (B-Blocks:93: label top 68, arrow 96). */
const LABEL_GAP = 12
/** Space under the last arrow (B-Blocks:78: last arrow 356 in a 400 box). */
const BOTTOM = 44
/** Lifelines stop short of the box bottom (B-Blocks:79: 346 from 44 in 400). */
const LIFELINE_INSET = 10
/** Arrow tips stop 1px short of the target lifeline (B-Blocks:83: 80 to 239). */
const TIP_GAP = 1
const ACTOR_PAD_X = 6
const LABEL_INSET = 16
export const SELF_LOOP_WIDTH = 26
const SELF_LOOP_HEIGHT = 16
const SELF_LABEL_OFFSET = 34
/** A self-message owns its row, so its label may run across two lanes. */
const SELF_LABEL_LANES = 2

export interface SeqActorLayout {
  name: string
  x: number
  lines: string[]
}

export interface SeqStepLayout {
  self: boolean
  /** A reply goes back over a pair an earlier step went forward on. */
  reply: boolean
  x1: number
  x2: number
  y: number
  lines: string[]
  /** Left edge of the label box, and its width. A centered label is centered in it. */
  labelLeft: number
  labelWidth: number
  labelTop: number
  centered: boolean
}

export interface SeqLayout {
  width: number
  height: number
  actorHeight: number
  lifelineBottom: number
  actors: SeqActorLayout[]
  steps: SeqStepLayout[]
}

/** True for each step that answers an earlier one: same two actors, opposite way. */
function replyFlags(steps: readonly SeqStep[]): boolean[] {
  const forward = new Set<string>()
  return steps.map((s) => {
    if (s.from === s.to) return false
    const reply = forward.has(`${s.to}\u0000${s.from}`)
    if (!reply) forward.add(`${s.from}\u0000${s.to}`)
    return reply
  })
}

/** The label as drawn: its 1-based number, then the payload text (B-Blocks:93). */
export function numberedLabel(index: number, label: string): string {
  return `${index + 1} ${label}`
}

export function computeSeqLayout(actorNames: string[], steps: SeqStep[]): SeqLayout {
  const actors: SeqActorLayout[] = actorNames.map((name, i) => ({
    name,
    x: LANE / 2 + i * LANE,
    lines: wrapText(name, ACTOR_WIDTH - 2 * ACTOR_PAD_X, ACTOR_FONT_SIZE),
  }))
  const actorHeight = Math.max(
    ACTOR_MIN_HEIGHT,
    ...actors.map((a) => a.lines.length * LINE_HEIGHT + 2 * ACTOR_PAD_X),
  )

  const indexOf = new Map(actorNames.map((name, i) => [name, i]))
  const replies = replyFlags(steps)
  let rightEdge = actorNames.length * LANE
  let previousY = actorHeight
  const laid: SeqStepLayout[] = steps.map((s, i) => {
    const fromIndex = indexOf.get(s.from) ?? 0
    const toIndex = indexOf.get(s.to) ?? 0
    const x1 = LANE / 2 + fromIndex * LANE
    const x2 = LANE / 2 + toIndex * LANE
    const text = numberedLabel(i, s.label)

    if (s.from === s.to) {
      const room = SELF_LABEL_LANES * LANE - SELF_LABEL_OFFSET - LABEL_INSET
      const lines = wrapText(text, room, LABEL_FONT_SIZE)
      const labelHeight = lines.length * LINE_HEIGHT
      const y = previousY + Math.max(ROW_PITCH, labelHeight + LABEL_GAP)
      previousY = y + SELF_LOOP_HEIGHT
      const labelWidth = Math.ceil(widestLine(lines, LABEL_FONT_SIZE))
      rightEdge = Math.max(rightEdge, x1 + SELF_LABEL_OFFSET + labelWidth)
      return {
        self: true,
        reply: false,
        x1,
        x2,
        y,
        lines,
        labelLeft: x1 + SELF_LABEL_OFFSET,
        labelWidth,
        labelTop: y + SELF_LOOP_HEIGHT / 2 - labelHeight / 2,
        centered: false,
      }
    }

    const span = Math.abs(toIndex - fromIndex)
    const lines = wrapText(text, span * LANE - LABEL_INSET, LABEL_FONT_SIZE)
    const extra = (lines.length - 1) * LINE_HEIGHT
    const y = previousY + ROW_PITCH + extra
    previousY = y
    const labelWidth = Math.ceil(widestLine(lines, LABEL_FONT_SIZE))
    const mid = (x1 + x2) / 2
    const dir = x2 > x1 ? 1 : -1
    return {
      self: false,
      reply: replies[i] ?? false,
      x1,
      x2: x2 - dir * TIP_GAP,
      y,
      lines,
      labelLeft: mid - labelWidth / 2,
      labelWidth,
      labelTop: y - LABEL_GAP - lines.length * LINE_HEIGHT,
      centered: true,
    }
  })

  const height = previousY + BOTTOM
  return {
    width: Math.round(rightEdge),
    height: Math.round(height),
    actorHeight,
    lifelineBottom: Math.round(height) - LIFELINE_INSET,
    actors,
    steps: laid,
  }
}
