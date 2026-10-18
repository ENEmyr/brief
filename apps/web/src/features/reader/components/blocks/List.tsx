import type { Block } from '@brief/schema'
import { Annotatable } from '@/features/annotations'
import type { Highlight } from '@/features/reader-state'
import { BlockCard, cardHeader } from '../BlockCard'

// Owner ruling D7: drawn from existing parts. Items take the paragraph type
// (B-Reader:107, B-Mobile:33) and the card body's 14px inset; bullets take
// B-Print:82's 22px list indent. Native markers keep bullets and numbers on
// paper and out of the copied text.
const LIST_CLASS =
  'm-0 flex flex-col py-3 pr-3.5 text-[15px] leading-[26px] text-text marker:text-faint max-[880px]:text-[16px] max-[880px]:leading-[27px] max-[880px]:text-[var(--c-body)]'

// The ol is set in mono so `ch` is one numeral of its mono marker: the indent
// fits "100. " as well as "1. ", and no number runs past the card edge.
const markerIndent = (count: number) => ({
  paddingLeft: `calc(14px + ${String(count).length + 2}ch)`,
})

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
  const Tag = block.ordered ? 'ol' : 'ul'

  return (
    <BlockCard {...cardHeader(block, { sid, bid, pathPrefix, annotatable, onMarkClick })}>
      <Tag
        className={`${LIST_CLASS} ${block.ordered ? 'list-decimal font-mono marker:font-mono' : 'list-disc pl-9'}`}
        style={block.ordered ? markerIndent(block.items.length) : undefined}
      >
        {block.items.map((item, i) => (
          <Annotatable
            key={i}
            as="li"
            className="break-words font-sans"
            text={item}
            sid={sid}
            bid={bid ?? null}
            path={`${pathPrefix}items.${i}`}
            markdown
            annotatable={annotatable && bid !== undefined}
            onMarkClick={onMarkClick}
          />
        ))}
      </Tag>
    </BlockCard>
  )
}
