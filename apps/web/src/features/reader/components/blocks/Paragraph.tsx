import type { Block } from '@brief/schema'
import { HighlightedText } from '@/features/annotations'
import type { Highlight } from '@/features/reader-state'

const PARAGRAPH_CLASS = 'text-[15px] leading-[1.85] text-text mb-3.5'

/** Top-level paragraphs (annotatable, with real sid/bid indices) render
 * through HighlightedText and carry the [data-hl] selection anchor.
 * Paragraphs without indices, or explicitly marked non-annotatable
 * (details-nested content, per controller adjudication), render plain --
 * a defaulted index would silently alias section 0's first paragraph and
 * cross-contaminate highlights. `onMarkClick` is prop-drilled down from
 * SessionView (via SectionView/BlockRenderer) to HighlightedText, which
 * already accepts it -- see Task 3. */
export function Paragraph({
  block,
  sid,
  bid,
  annotatable = true,
  onMarkClick,
}: {
  block: Extract<Block, { type: 'p' }>
  sid?: number
  bid?: number
  annotatable?: boolean
  onMarkClick?: (highlight: Highlight) => void
}) {
  if (!annotatable || sid === undefined || bid === undefined) {
    return (
      <p data-block="p" className={PARAGRAPH_CLASS}>
        {block.text}
      </p>
    )
  }
  return (
    <p data-block="p" data-hl data-sid={sid} data-bid={bid} className={PARAGRAPH_CLASS}>
      <HighlightedText sid={sid} bid={bid} text={block.text} onMarkClick={onMarkClick} />
    </p>
  )
}
