export type InlineKind = 'plain' | 'code' | 'strong' | 'em'

/**
 * One run of a source string. Runs tile the source exactly: `start`..`end` are
 * source offsets of the whole run, markers included, and `marker` is the length
 * of each of its two markers (0 for plain text). The visible content is
 * `source.slice(start + marker, end - marker)`.
 */
export interface InlineRun {
  kind: InlineKind
  start: number
  end: number
  marker: number
}

const SPACE = /\s/

/** A closed run starting at i, or null when the marker at i has no valid partner. */
function spanAt(src: string, i: number): InlineRun | null {
  if (src[i] === '`') {
    const close = src.indexOf('`', i + 1)
    return close > i + 1 ? { kind: 'code', start: i, end: close + 1, marker: 1 } : null
  }
  if (src[i] !== '*') return null
  const marker = src[i + 1] === '*' ? 2 : 1
  let close = -1
  for (let j = i + marker; j < src.length; j++) {
    if (
      marker === 2
        ? src.startsWith('**', j)
        : src[j] === '*' && src[j - 1] !== '*' && src[j + 1] !== '*'
    ) {
      close = j
      break
    }
  }
  if (close < 0) return null
  const content = src.slice(i + marker, close)
  // "2 * 3 * 4" is arithmetic, not emphasis: like CommonMark, a run may not
  // open or close against whitespace.
  if (!content || SPACE.test(content[0] ?? '') || SPACE.test(content.at(-1) ?? '')) return null
  return { kind: marker === 2 ? 'strong' : 'em', start: i, end: close + marker, marker }
}

/**
 * Splits agent prose into plain, `code`, **strong** and *em* runs. Nothing
 * nests: a run's content is literal text, so a marker inside another run, or
 * one with no partner, renders as the character it is.
 */
export function parseInline(src: string): InlineRun[] {
  const runs: InlineRun[] = []
  let plainStart = 0
  let i = 0
  while (i < src.length) {
    const run = spanAt(src, i)
    if (!run) {
      i++
      continue
    }
    if (i > plainStart) runs.push({ kind: 'plain', start: plainStart, end: i, marker: 0 })
    runs.push(run)
    i = run.end
    plainStart = i
  }
  if (src.length > plainStart)
    runs.push({ kind: 'plain', start: plainStart, end: src.length, marker: 0 })
  return runs
}

/** The characters a reader sees between two source offsets: the source with
 * every marker inside the range dropped. */
export function visibleSlice(src: string, start: number, end: number): string {
  return parseInline(src)
    .map((run) =>
      src.slice(Math.max(start, run.start + run.marker), Math.min(end, run.end - run.marker)),
    )
    .join('')
}
