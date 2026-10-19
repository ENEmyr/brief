import type { Highlight } from '@/features/reader-state'

/**
 * Which marks draw each of `length` characters, outermost first, or null.
 * `highlights` must be sorted by start. Each character belongs to one owner, so
 * the DOM never repeats text: a highlight wholly inside its owner takes the
 * character, and where two only partly overlap the earlier-starting one keeps it.
 * A highlight with the same range as an earlier one shares that owner's
 * characters and nests inside its mark, so both stay clickable. Characters with
 * the same owner share one stack array, so a run of them compares by reference.
 */
export function markStacks(highlights: Highlight[], length: number): (Highlight[] | null)[] {
  const stacks = new Map<Highlight, Highlight[]>()
  const owner = new Array<Highlight | null>(length).fill(null)
  for (const h of highlights) {
    const twin = [...stacks.keys()].find((o) => o.start === h.start && o.end === h.end)
    if (twin) {
      stacks.get(twin)?.push(h)
      continue
    }
    stacks.set(h, [h])
    for (let i = Math.max(0, h.start); i < Math.min(h.end, length); i++) {
      const o = owner[i] ?? null
      if (!o || (o.start <= h.start && h.end <= o.end)) owner[i] = h
    }
  }
  return owner.map((o) => (o ? (stacks.get(o) ?? null) : null))
}
