'use client'
import { DEFAULT_HIGHLIGHT_PATH, useReaderState } from '@/features/reader-state'
import type { Highlight } from '@/features/reader-state'
import { GlossaryTerm, useLeafTerms } from '@/features/glossary'
import type { TermHit } from '@/features/glossary'
import { Fragment } from 'react'
import { parseInline } from '../lib/inlineMarkdown'

/**
 * Renders one leaf string with its highlights spliced in as <mark> segments.
 * Highlights for this (sid, bid, path) are sorted by start, and the walk tracks
 * `cur` so text already covered by an earlier mark is not re-emitted.
 * Overlapping highlights each still slice their own full start..end range.
 *
 * A highlight whose stored text no longer matches the characters at its offsets
 * is dropped rather than painted. That single check covers every way an anchor
 * can go stale at once: the payload was edited under it, the persisted state was
 * hand-edited or corrupted, or it was written against an older anchor model.
 * Painting it anyway would highlight arbitrary characters the reader never
 * selected, which is worse than not painting it.
 */
export function HighlightedText({
  sid,
  bid,
  path = DEFAULT_HIGHLIGHT_PATH,
  text,
  markdown = false,
  onMarkClick = () => {},
}: {
  sid: number
  bid: number | null
  path?: string
  text: string
  markdown?: boolean
  onMarkClick?: (highlight: Highlight) => void
}) {
  const { highlights } = useReaderState()
  const terms = useLeafTerms(sid, bid, path)
  const hs = highlights
    .filter(
      (h) =>
        h.sid === sid &&
        (h.bid ?? null) === bid &&
        (h.path ?? DEFAULT_HIGHLIGHT_PATH) === path &&
        text.slice(h.start, h.end) === h.text,
    )
    .sort((a, b) => a.start - b.start)

  if (markdown) return <InlineMarkdown text={text} highlights={hs} terms={terms} onMarkClick={onMarkClick} />
  if (!hs.length) return <>{text}</>

  const out: React.ReactNode[] = []
  let cur = 0
  hs.forEach((h) => {
    if (h.start > cur) out.push(text.slice(cur, h.start))
    out.push(markFor(h, text.slice(h.start, h.end), h.id, true, onMarkClick))
    cur = Math.max(cur, h.end)
  })
  if (cur < text.length) out.push(text.slice(cur))

  return <>{out}</>
}

// Where the last press on a mark began. One pointer presses one mark at a time.
let pressAt: { x: number; y: number } | null = null

function markFor(
  h: Highlight,
  children: React.ReactNode,
  key: string,
  withMarker: boolean,
  onMarkClick: (highlight: Highlight) => void,
) {
  const isAsk = h.question !== undefined
  return (
    <mark
      key={key}
      data-mark-id={h.id}
      data-marker={withMarker ? (isAsk ? 'ask' : h.note !== null ? 'note' : undefined) : undefined}
      // A drag that starts and ends in one mark also clicks it; that drag is a
      // new selection for the toolbar, not a request to open this mark.
      onMouseDown={(e) => {
        pressAt = { x: e.clientX, y: e.clientY }
      }}
      onClick={(e) => {
        const moved = pressAt !== null && (e.clientX !== pressAt.x || e.clientY !== pressAt.y)
        pressAt = null
        if (!moved) onMarkClick(h)
      }}
      className={
        isAsk
          ? 'cursor-pointer rounded-[3px] bg-accent-soft px-[2px] text-accent-text'
          : 'cursor-pointer rounded-[3px] px-[2px]'
      }
      style={
        isAsk
          ? { boxShadow: 'inset 0 -2px 0 var(--c-accent-line)' }
          : { background: 'var(--c-mark)', color: 'var(--c-mark-text)' }
      }
    >
      {children}
    </mark>
  )
}

const RUN_TAG = { code: 'code', strong: 'strong', em: 'em' } as const

// No board draws code in prose. The chip copies the only inline mono chip
// on a board, the palette's block kind (B-Components:112: 0 4px padding, 1px
// line2 border, 3px radius), at the code size 13 (tokens.css type scale) on
// the code block's --c-code-bg. A path has no spaces to break at, so it may
// break anywhere rather than push a 388 px page sideways, and each wrapped
// line keeps its own chip edges. Bold is the boards' run-in <b> (B-States:117,
// as NoDecisionsNote renders it).
const RUN_CLASS = {
  code: 'rounded-[3px] border border-line2 bg-[var(--c-code-bg)] px-[4px] font-mono text-[13px] [overflow-wrap:anywhere] box-decoration-clone',
  strong: 'font-bold text-text',
  em: 'italic',
} as const

/**
 * Renders a leaf's source string as its inline runs, with highlights drawn in
 * source offsets. Markers stay in the DOM as hidden text, so the leaf's
 * textContent is still exactly the source string: the selection walker in
 * lib/offsets.ts then measures source offsets with no mapping, and a highlight
 * stored before markdown rendered (when visible text was the source) still
 * lands on the same characters.
 *
 * Each source character belongs to at most one mark, so the DOM never repeats
 * text. A highlight that lies wholly inside another owns its characters, so a
 * nested highlight, note or ask draws its own mark and marker; where two only
 * partly overlap, the earlier-starting one keeps the shared part. A highlight that
 * crosses a run boundary draws as one <mark> per run, and only its last piece
 * carries the note or ask marker.
 */
export function InlineMarkdown({
  text,
  highlights,
  terms = [],
  onMarkClick,
}: {
  text: string
  highlights: Highlight[]
  /** Glossary first uses to underline; each lies inside one run's content. */
  terms?: TermHit[]
  onMarkClick: (highlight: Highlight) => void
}) {
  const termAt = new Array<number | null>(text.length).fill(null)
  for (const t of terms) for (let i = t.start; i < t.end; i++) termAt[i] = t.n
  const owner: (Highlight | null)[] = new Array<Highlight | null>(text.length).fill(null)
  for (const h of highlights) {
    for (let i = h.start; i < h.end; i++) {
      const o = owner[i] ?? null
      if (!o || (o.start <= h.start && h.end <= o.end)) owner[i] = h
    }
  }
  const runs = parseInline(text)
  const hidden = new Array<boolean>(text.length).fill(false)
  for (const run of runs) {
    for (let k = 0; k < run.marker; k++) {
      hidden[run.start + k] = true
      hidden[run.end - 1 - k] = true
    }
  }
  // A highlight stored before markdown rendered may cover marker characters
  // only. Show those characters inside its mark, so it still draws.
  const markersOnly = new Set(highlights.filter((h) => hidden.slice(h.start, h.end).every(Boolean)))
  owner.forEach((h, i) => {
    if (h && markersOnly.has(h)) hidden[i] = false
  })
  const lastPiece = new Map<string, number>()
  owner.forEach((h, i) => {
    if (h && !hidden[i]) lastPiece.set(h.id, i)
  })

  return (
    <>
      {runs.map((run) => {
        const pieces: { node: React.ReactNode; term: number | null }[] = []
        const contentStart = run.start + run.marker
        const contentEnd = run.end - run.marker
        let i = run.start
        while (i < run.end) {
          const zoneEnd = i < contentStart ? contentStart : i >= contentEnd ? run.end : contentEnd
          const isMarker = hidden[i]
          const h = owner[i] ?? null
          const term = termAt[i] ?? null
          let j = i + 1
          while (j < zoneEnd && (owner[j] ?? null) === h && (termAt[j] ?? null) === term) j++
          const slice = text.slice(i, j)
          if (isMarker)
            pieces.push({
              node: (
                <span key={i} hidden>
                  {slice}
                </span>
              ),
              term,
            })
          else if (h)
            pieces.push({
              node: markFor(h, slice, `${h.id}:${i}`, lastPiece.get(h.id) === j - 1, onMarkClick),
              term,
            })
          else pieces.push({ node: <Fragment key={i}>{slice}</Fragment>, term })
          i = j
        }
        const content = groupTerms(pieces)
        if (run.kind === 'plain') return <Fragment key={run.start}>{content}</Fragment>
        const Tag = RUN_TAG[run.kind]
        return (
          <Tag key={run.start} className={RUN_CLASS[run.kind]}>
            {content}
          </Tag>
        )
      })}
    </>
  )
}

/** Wraps each stretch of pieces that belongs to one glossary term in its
 * GlossaryTerm, so a highlight crossing a term edge splits into one mark on
 * each side, the way it already splits at a run edge. */
function groupTerms(pieces: { node: React.ReactNode; term: number | null }[]): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let k = 0
  while (k < pieces.length) {
    const term = pieces[k]?.term ?? null
    if (term === null) {
      out.push(pieces[k]?.node)
      k++
      continue
    }
    let m = k
    while (m < pieces.length && pieces[m]?.term === term) m++
    out.push(
      <GlossaryTerm key={`term:${k}`} n={term}>
        {pieces.slice(k, m).map((p) => p.node)}
      </GlossaryTerm>,
    )
    k = m
  }
  return out
}
