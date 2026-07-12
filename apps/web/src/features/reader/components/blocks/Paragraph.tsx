import type { Block } from '@brief/schema'
import { Annotatable } from '@/features/annotations'
import type { Highlight } from '@/features/reader-state'

const PARAGRAPH_CLASS = 'text-[15px] leading-[1.85] text-text mb-3.5'

/** A paragraph's one string leaf is `text`. `pathPrefix` is set when the block
 * is nested (inside a details), so its leaf is addressed as `blocks.2.text`
 * rather than colliding with the containing block's own `text`. */
export function Paragraph({
  block,
  sid,
  bid,
  pathPrefix = '',
  annotatable = true,
  onMarkClick,
}: {
  block: Extract<Block, { type: 'p' }>
  sid?: number
  bid?: number
  pathPrefix?: string
  annotatable?: boolean
  onMarkClick?: (highlight: Highlight) => void
}) {
  return (
    <Annotatable
      as="p"
      className={PARAGRAPH_CLASS}
      text={block.text}
      sid={sid}
      bid={bid ?? null}
      path={`${pathPrefix}text`}
      annotatable={annotatable && bid !== undefined}
      onMarkClick={onMarkClick}
    />
  )
}
