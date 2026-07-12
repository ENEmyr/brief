/**
 * Shared text helpers for the hand-drawn SVG diagram blocks (seq, state,
 * layers, erd).
 *
 * Two things every one of those blocks needs and none of them had:
 *
 * 1. A font stack that can actually draw the payload. The blocks hardcoded
 *    `font-family="'IBM Plex Mono', monospace"`, and IBM Plex Mono has no Thai
 *    coverage, so Thai labels dropped to whatever generic mono the OS picked.
 *    The stack below keeps Plex Mono first (Latin diagrams look unchanged) and
 *    puts IBM Plex Sans Thai behind it, so per-glyph fallback lands on a face
 *    that has the glyph. Note it is applied through the `style` prop on
 *    purpose: `var()` does not resolve inside an SVG presentation attribute.
 *
 * 2. A width estimate. There is no measurement API available during render, so
 *    labels are estimated from their advance-bearing character count. Thai
 *    combining vowels and tone marks stack on the preceding consonant and take
 *    no horizontal space, so they must not be counted.
 */
import type { CSSProperties } from 'react'

/**
 * `--font-plex-mono` and `--font-plex-sans` are the next/font variables defined
 * on <html> (see app/layout.tsx); the literal families are the fallback for any
 * context that renders this markup without those variables.
 */
export const DIAGRAM_FONT_STACK =
  "var(--font-plex-mono, 'IBM Plex Mono'), var(--font-plex-sans, 'IBM Plex Sans Thai'), 'IBM Plex Sans Thai', ui-monospace, monospace"

/** Style for an SVG <text> node. Merges the diagram font stack with `extra`. */
export function svgTextStyle(extra?: CSSProperties): CSSProperties {
  return { fontFamily: DIAGRAM_FONT_STACK, ...extra }
}

// Thai vowels above/below and tone marks (U+0E31, U+0E34-U+0E3A, U+0E47-U+0E4E)
// plus generic combining marks: all zero-advance.
const ZERO_ADVANCE = /[ัิ-ฺ็-๎̀-ͯ]/

/** Average advance of one character, as a fraction of the font size. */
const ADVANCE_EM = 0.62

/** Slack over the estimate, since the estimate is an average and not a measure. */
const WIDTH_SLACK = 1.25

/** Characters that actually consume horizontal space. */
export function advanceCount(text: string): number {
  let n = 0
  for (const ch of text) if (!ZERO_ADVANCE.test(ch)) n += 1
  return n
}

/** Measure-free width estimate for `text` at `fontSize`, in SVG user units. */
export function estimateTextWidth(text: string, fontSize: number): number {
  return advanceCount(text) * fontSize * ADVANCE_EM * WIDTH_SLACK
}

/**
 * Break `text` into line-break candidates. Thai writes without spaces, so a
 * space-based split treats a whole sentence as one unbreakable word; the ICU
 * dictionary behind Intl.Segmenter is what gives us Thai word boundaries.
 * Punctuation is glued to the surrounding word so "1-5" never splits.
 */
function chunk(text: string): string[] {
  const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('th', { granularity: 'word' }) : null
  if (!segmenter) return text.split(/(?<=\s)/).filter(Boolean)

  const chunks: string[] = []
  let current = ''
  let afterSpace = false
  let afterWord = false
  for (const { segment, isWordLike } of segmenter.segment(text)) {
    const breakHere = afterSpace || (isWordLike === true && afterWord)
    if (breakHere && current !== '') {
      chunks.push(current)
      current = segment
    } else {
      current += segment
    }
    afterSpace = segment.trim() === ''
    afterWord = isWordLike === true
  }
  if (current !== '') chunks.push(current)
  return chunks
}

/** Split a chunk that is wider than the whole line, at character boundaries. */
function hardSplit(word: string, maxWidth: number, fontSize: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const ch of word) {
    const next = line + ch
    if (line !== '' && estimateTextWidth(next, fontSize) > maxWidth) {
      lines.push(line)
      line = ch
    } else {
      line = next
    }
  }
  if (line !== '') lines.push(line)
  return lines
}

/**
 * Greedy word wrap against the estimated width. Returns at least one line.
 */
export function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  if (text === '') return ['']
  const lines: string[] = []
  let line = ''

  const flush = () => {
    if (line.trimEnd() !== '') lines.push(line.trimEnd())
    line = ''
  }

  for (const piece of chunk(text)) {
    const candidate = line + piece
    if (line !== '' && estimateTextWidth(candidate.trimEnd(), fontSize) > maxWidth) {
      flush()
      line = piece.trimStart()
    } else {
      line = candidate
    }
    if (estimateTextWidth(line.trimEnd(), fontSize) > maxWidth) {
      const parts = hardSplit(line.trimEnd(), maxWidth, fontSize)
      line = parts.pop() ?? ''
      lines.push(...parts)
    }
  }
  flush()
  return lines.length > 0 ? lines : ['']
}

/** Width of the widest line in an already-wrapped label. */
export function widestLine(lines: string[], fontSize: number): number {
  return lines.reduce((w, l) => Math.max(w, estimateTextWidth(l, fontSize)), 0)
}
