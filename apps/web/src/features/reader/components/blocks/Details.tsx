'use client'
import { useState } from 'react'
import type { StoredDetailsBlock } from '@brief/schema'
import type { Highlight } from '@/features/reader-state'
import { BlockRenderer } from '../BlockRenderer'
import { BlockCard, NestedInCard, cardHeader } from '../BlockCard'

/**
 * Nested content IS annotatable. It could not be before, because an anchor was
 * only (sid, bid, offsets) and a nested paragraph has no top-level block index
 * of its own, so a defaulted index would have aliased another block's
 * highlights. A leaf path solves it: the nested block's leaves are addressed
 * under `blocks.<i>.`, within the details block's own bid.
 *
 * The marker is the only open or closed signal (bug-108), so it is two glyphs
 * driven by the element's own toggle event, not one glyph turned by CSS:
 * ▾ in accent when open, ▸ in faint when closed (B-Blocks:166, :173).
 */
export function Details({
  block,
  sid,
  bid,
  pathPrefix = '',
  annotatable = true,
  onMarkClick,
}: {
  block: StoredDetailsBlock
  sid?: number
  bid?: number
  pathPrefix?: string
  annotatable?: boolean
  onMarkClick?: (highlight: Highlight) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <BlockCard
      {...cardHeader(block, { sid, bid, pathPrefix, annotatable, onMarkClick })}
      alsoKinds={block.blocks.some((b) => b.type === 'math' && b.title === undefined) ? ['math'] : []}
    >
      <div className="p-2">
        <details
          open={open}
          onToggle={(event) => setOpen(event.currentTarget.open)}
          className={`rounded-[4px] ${open ? 'bg-elev' : ''}`}
        >
          <summary
            className={`flex min-h-10 cursor-pointer list-none items-center gap-2.5 px-3 text-[14px] font-medium leading-[normal] max-[880px]:min-h-11 [&::-webkit-details-marker]:hidden ${open ? 'text-text' : 'text-sub'}`}
          >
            <span
              aria-hidden="true"
              data-details-marker
              className={`font-mono ${open ? 'text-accent-text' : 'text-faint'}`}
            >
              {open ? '▾' : '▸'}
            </span>
            <span>{block.summary}</span>
          </summary>
          <div className="flex flex-col gap-2.5 pb-3 pl-8 pr-3 [&>p]:text-[14px] [&>p]:leading-[22px] [&>p]:text-sub">
            <NestedInCard.Provider value>
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
            </NestedInCard.Provider>
          </div>
        </details>
      </div>
    </BlockCard>
  )
}
