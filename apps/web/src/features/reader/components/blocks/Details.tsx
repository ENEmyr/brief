import type { Block } from '@brief/schema'
import type { Highlight } from '@/features/reader-state'
import { BlockRenderer } from '../BlockRenderer'

/**
 * Nested content IS annotatable. It could not be before, because an anchor was
 * only (sid, bid, offsets) and a nested paragraph has no top-level block index
 * of its own, so a defaulted index would have aliased another block's
 * highlights. A leaf path solves it: the nested block's leaves are addressed
 * under `blocks.<i>.`, within the details block's own bid.
 */
export function Details({
  block,
  sid,
  bid,
  pathPrefix = '',
  annotatable = true,
  onMarkClick,
}: {
  block: Extract<Block, { type: 'details' }>
  sid?: number
  bid?: number
  pathPrefix?: string
  annotatable?: boolean
  onMarkClick?: (highlight: Highlight) => void
}) {
  return (
    <details className="group border border-line rounded-[10px] bg-elev my-3.5 overflow-hidden">
      <summary className="w-full flex items-center gap-[9px] text-[13.5px] font-semibold px-[15px] py-[11px] text-left cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="text-mauve transition-transform duration-[180ms] group-open:rotate-90 inline-block"
        >
          ▸
        </span>
        <span>{block.summary}</span>
      </summary>
      <div className="pl-[35px] pr-[15px] pb-[13px] text-[13.5px] leading-[1.75] text-sub">
        {block.blocks.map((b, i) => (
          <BlockRenderer
            key={i}
            block={b}
            sid={sid}
            bid={bid}
            pathPrefix={`${pathPrefix}blocks.${i}.`}
            annotatable={annotatable}
            onMarkClick={onMarkClick}
          />
        ))}
      </div>
    </details>
  )
}
