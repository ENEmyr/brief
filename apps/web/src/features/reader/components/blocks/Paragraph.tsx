import type { Block } from '@brief/schema'
import { Annotatable } from '@/features/annotations'
import type { Highlight } from '@/features/reader-state'

// Body 15/26 (B-Reader:107); under 880 B-Mobile:33 sets 16/27 in --c-body.
const PARAGRAPH_CLASS =
  'm-0 text-[15px] leading-[26px] text-text max-[880px]:text-[16px] max-[880px]:leading-[27px] max-[880px]:text-[var(--c-body)]'

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
