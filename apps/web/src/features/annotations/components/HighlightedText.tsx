'use client'
import { DEFAULT_HIGHLIGHT_PATH, useReaderState } from '@/features/reader-state'
import type { Highlight } from '@/features/reader-state'

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
  onMarkClick = () => {},
}: {
  sid: number
  bid: number | null
  path?: string
  text: string
  onMarkClick?: (highlight: Highlight) => void
}) {
  const { highlights } = useReaderState()
  const hs = highlights
    .filter(
      (h) =>
        h.sid === sid &&
        (h.bid ?? null) === bid &&
        (h.path ?? DEFAULT_HIGHLIGHT_PATH) === path &&
        text.slice(h.start, h.end) === h.text,
    )
    .sort((a, b) => a.start - b.start)

  if (!hs.length) return <>{text}</>

  const out: React.ReactNode[] = []
  let cur = 0
  hs.forEach((h) => {
    if (h.start > cur) out.push(text.slice(cur, h.start))
    const segment = text.slice(h.start, h.end)
    const isAsk = h.question !== undefined
    out.push(
      <mark
        key={h.id}
        onClick={() => onMarkClick(h)}
        className={
          isAsk
            ? 'cursor-pointer rounded-[3px] bg-mauvesoft px-[2px] text-mauve'
            : 'cursor-pointer rounded-[3px] px-[2px]'
        }
        style={
          isAsk
            ? { boxShadow: 'inset 0 -2px 0 var(--ctp-mauve)' }
            : { background: 'var(--ctp-mark)', color: 'var(--ctp-marktx)' }
        }
      >
        {segment}
        {isAsk ? (
          <sup className="ml-px text-[10px] font-bold text-mauve">?</sup>
        ) : h.note !== null ? (
          <sup className="ml-px text-[10px] font-bold text-mauve">●</sup>
        ) : null}
      </mark>,
    )
    cur = Math.max(cur, h.end)
  })
  if (cur < text.length) out.push(text.slice(cur))

  return <>{out}</>
}
