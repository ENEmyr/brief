import type { Block } from '@brief/schema'
import { Annotatable } from '@/features/annotations'
import type { Highlight } from '@/features/reader-state'
import { BlockCard, cardHeader } from '../BlockCard'

type CalloutBlock = Extract<Block, { type: 'note' | 'warn' | 'good' }>

// B-Blocks:34-36: a 1px status border on a soft fill, and the kind as a
// caps label in the status color.
const tone = {
  note: { box: 'border-info-line bg-info-soft', label: 'text-info' },
  warn: { box: 'border-warn-line bg-[var(--c-callout-warn)]', label: 'text-warn' },
  good: { box: 'border-good-line bg-[var(--c-callout-good)]', label: 'text-good' },
} as const

/**
 * The title and the body are separate leaves. They have to be: the callout's
 * flattened DOM text is title followed by text, so a single whole-block anchor
 * would slice the model's `text` field at offsets measured across both, and
 * every highlight in the body would land title.length characters early.
 */
export function Callout({
  block,
  sid,
  bid,
  pathPrefix = '',
  annotatable = true,
  onMarkClick,
}: {
  block: CalloutBlock
  sid?: number
  bid?: number
  pathPrefix?: string
  annotatable?: boolean
  onMarkClick?: (highlight: Highlight) => void
}) {
  const anchor = {
    sid,
    bid: bid ?? null,
    annotatable: annotatable && bid !== undefined,
    onMarkClick,
  }

  return (
    <BlockCard {...cardHeader(block, { sid, bid, pathPrefix, annotatable, onMarkClick })}>
      <div className="p-3">
        <aside className={`flex gap-3 rounded-[4px] border px-3.5 py-3 ${tone[block.type].box}`}>
          <span
            className={`w-10 shrink-0 pt-[3px] font-mono text-[11px] leading-[normal] ${tone[block.type].label}`}
          >
            {block.type.toUpperCase()}
          </span>
          <div className="min-w-0 text-[15px] leading-[26px] text-text">
            {block.title ? (
              <Annotatable
                {...anchor}
                as="p"
                className="m-0 font-semibold"
                text={block.title}
                path={`${pathPrefix}title`}
                markdown
              />
            ) : null}
            <Annotatable
              {...anchor}
              as="p"
              className="m-0"
              text={block.text}
              path={`${pathPrefix}text`}
              markdown
            />
          </div>
        </aside>
      </div>
    </BlockCard>
  )
}
