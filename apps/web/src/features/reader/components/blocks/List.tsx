import type { Block } from '@brief/schema'
import { Annotatable } from '@/features/annotations'
import type { Highlight } from '@/features/reader-state'
import { BlockCard, cardHeader } from '../BlockCard'

// Owner ruling D7: drawn from existing parts. Items take the paragraph type
// (B-Reader:107, B-Mobile:33); the indent is the card's 14px body inset plus
// B-Print:82's 22px list indent. Native markers keep bullets and numbers on
// paper and out of the copied text.
const LIST_CLASS =
  'm-0 flex flex-col py-3 pr-3.5 pl-9 text-[15px] leading-[26px] text-text marker:text-faint max-[880px]:text-[16px] max-[880px]:leading-[27px] max-[880px]:text-[var(--c-body)]'

const MARKERS = {
  ordered: { Tag: 'ol', className: 'list-decimal marker:font-mono' },
  bulleted: { Tag: 'ul', className: 'list-disc' },
} as const

export function List({
  block,
  sid,
  bid,
  pathPrefix = '',
  annotatable = true,
  onMarkClick,
}: {
  block: Extract<Block, { type: 'list' }>
  sid?: number
  bid?: number
  pathPrefix?: string
  annotatable?: boolean
  onMarkClick?: (highlight: Highlight) => void
}) {
  const { Tag, className } = MARKERS[block.ordered ? 'ordered' : 'bulleted']

  return (
    <BlockCard {...cardHeader(block, { sid, bid, pathPrefix, annotatable, onMarkClick })}>
      <Tag className={`${LIST_CLASS} ${className}`}>
        {block.items.map((item, i) => (
          <Annotatable
            key={i}
            as="li"
            className="break-words"
            text={item}
            sid={sid}
            bid={bid ?? null}
            path={`${pathPrefix}items.${i}`}
            annotatable={annotatable && bid !== undefined}
            onMarkClick={onMarkClick}
          />
        ))}
      </Tag>
    </BlockCard>
  )
}
