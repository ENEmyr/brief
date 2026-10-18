import type { BaNote, CodeNote } from '@brief/schema'

export type NoteSide = 'code' | 'before' | 'after'

export interface PlacedNote {
  key: string
  /** Print letter (B-Print:58-66): A, B, ... Z, AA, AB, in listing order. */
  letter: string
  /** "L3" or "L3-4", as the pinned note's label draws it (B-NewBlocks:131). */
  range: string
  text: string
  side: NoteSide
  /** 0-based index of the last noted line: the diamond sits at its end. */
  line: number
}

const SIDE_ORDER: Record<NoteSide, number> = { code: 0, before: 1, after: 2 }

function letterFor(index: number): string {
  const head = index >= 26 ? letterFor(Math.floor(index / 26) - 1) : ''
  return head + String.fromCharCode(65 + (index % 26))
}

/**
 * Places an agent's notes on a listing. A note whose range runs backwards or
 * past the side's last line is dropped, not clamped: it would point at code
 * the agent did not mean.
 */
export function placeNotes(
  notes: readonly (CodeNote | BaNote)[] | undefined,
  lineCounts: Partial<Record<NoteSide, number>>,
): PlacedNote[] {
  const valid = (notes ?? []).flatMap((note, index) => {
    const side: NoteSide = 'side' in note ? note.side : 'code'
    const to = note.to ?? note.from
    const count = lineCounts[side] ?? 0
    if (note.from < 1 || to < note.from || to > count) return []
    const range = to === note.from ? `L${note.from}` : `L${note.from}-${to}`
    return [{ key: `${side}.${index}`, range, text: note.text, side, line: to - 1 }]
  })
  valid.sort((a, b) => SIDE_ORDER[a.side] - SIDE_ORDER[b.side] || a.line - b.line)
  return valid.map((note, i) => ({ ...note, letter: letterFor(i) }))
}

/** Notes keyed by `<side>.<line>`, the same suffix as each row's leaf path. */
export function notesByLine(placed: readonly PlacedNote[]): ReadonlyMap<string, PlacedNote[]> {
  const map = new Map<string, PlacedNote[]>()
  for (const note of placed) {
    const at = `${note.side}.${note.line}`
    map.set(at, [...(map.get(at) ?? []), note])
  }
  return map
}
