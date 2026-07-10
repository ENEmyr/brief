'use client'
import { useReaderState } from '@/features/reader-state'
import type { Highlight } from '@/features/reader-state'

/** Renders a paragraph's text with its highlights spliced in as <mark>
 * segments, mirroring the prototype's prose() (Reader.dc.html line 566):
 * highlights for this sid/bid are sorted by start, and the walk tracks `cur`
 * to avoid re-emitting plain text already covered by an earlier mark.
 * Overlapping highlights are rendered as-is (each mark still slices its own
 * full start..end range), matching the prototype rather than trying to be
 * smarter about clipping the rendered text — see task-p4-2-report.md. */
export function HighlightedText({
  sid,
  bid,
  text,
  onMarkClick = () => {},
}: {
  sid: number
  bid: number
  text: string
  onMarkClick?: (highlight: Highlight) => void
}) {
  const { highlights } = useReaderState()
  const hs = highlights.filter((h) => h.sid === sid && h.bid === bid).sort((a, b) => a.start - b.start)

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
