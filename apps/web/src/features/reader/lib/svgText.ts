/**
 * Text helpers for the hand-drawn diagram blocks (seq, state, layers, erd).
 *
 * Their layout needs label widths before anything is drawn, and there is no
 * measurement API during render, so labels are estimated from their
 * advance-bearing character count. Thai combining vowels and tone marks stack
 * on the preceding consonant and take no horizontal space, so they must not be
 * counted. The estimate errs wide; a label drawn as HTML then always fits.
 */

/**
 * `--font-geist-mono` and `--font-noto-thai` are the :root variables defined in
 * app/fonts.css; the literal families are the fallback for any context that
 * renders this markup without those variables.
 */
export const DIAGRAM_FONT_STACK =
  "var(--font-geist-mono, 'Geist Mono'), var(--font-noto-thai, 'Noto Sans Thai'), ui-monospace, monospace"

// Thai vowels above/below and tone marks (U+0E31, U+0E34-U+0E3A, U+0E47-U+0E4E)
// plus generic combining marks: all zero-advance.
const ZERO_ADVANCE = /[ัิ-ฺ็-๎̀-ͯ]/

// The Thai script block (U+0E00-U+0E7F). Any label containing a Thai
// character falls back off the first, monospace face in DIAGRAM_FONT_STACK
// onto Noto Sans Thai, a proportional face, so it needs the average + slack
// treatment below. Text with no Thai renders entirely in Geist Mono, whose
// advance per character is fixed and known, not estimated.
//
// The three constants below are measured in a browser with the real fonts by
// e2e/visual/tests/foundations.visual.spec.ts, which fails when they drift.
// Rerun it after any font change.
const THAI_SCRIPT = /[฀-๿]/

/** Average advance of one character in a Thai-containing label at weight 400,
 *  as a fraction of the font size (measured mean 0.5592). */
const ADVANCE_EM = 0.56

/** Slack over the average so the estimate covers the widest measured label,
 *  bold included (measured max 0.6467 em at weight 700). */
const WIDTH_SLACK = 1.16

/** Geist Mono's actual, fixed per-character advance. Latin/ASCII text
 *  always renders in this face, so this is exact, not an estimate, and
 *  carries no slack. */
const MONO_ADVANCE_EM = 0.6

/** Characters that actually consume horizontal space. */
export function advanceCount(text: string): number {
  let n = 0
  for (const ch of text) if (!ZERO_ADVANCE.test(ch)) n += 1
  return n
}

/** Measure-free width estimate for `text` at `fontSize`, in SVG user units. */
export function estimateTextWidth(text: string, fontSize: number): number {
  const n = advanceCount(text)
  if (!THAI_SCRIPT.test(text)) return n * fontSize * MONO_ADVANCE_EM
  return n * fontSize * ADVANCE_EM * WIDTH_SLACK
}

/** Null where Intl.Segmenter is missing, which drops us back to a space split. */
const WORD_SEGMENTER =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('th', { granularity: 'word' }) : null

/**
 * Break `text` into line-break candidates. Thai writes without spaces, so a
 * space-based split treats a whole sentence as one unbreakable word; the ICU
 * dictionary behind Intl.Segmenter is what gives us Thai word boundaries.
 * Punctuation is glued to the surrounding word so "1-5" never splits.
 */
function chunk(text: string): string[] {
  if (!WORD_SEGMENTER) return text.split(/(?<=\s)/).filter(Boolean)

  const chunks: string[] = []
  let current = ''
  let afterSpace = false
  let afterWord = false
  for (const { segment, isWordLike } of WORD_SEGMENTER.segment(text)) {
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
