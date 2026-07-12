import type { Block } from '@brief/schema'
import { Annotatable } from '@/features/annotations'
import type { Highlight } from '@/features/reader-state'

type CalloutBlock = Extract<Block, { type: 'note' | 'warn' | 'good' }>

const styles = {
  note: 'border-blue bg-[var(--callout-note-bg)]',
  warn: 'border-peach bg-[var(--callout-warn-bg)]',
  good: 'border-green bg-[var(--callout-good-bg)]',
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
    <aside
      className={`border-l-[3px] rounded-lg px-[15px] py-[11px] my-3.5 text-[14px] leading-[1.7] text-text ${styles[block.type]}`}
    >
      {block.title ? (
        <Annotatable
          {...anchor}
          as="p"
          className="mb-1 font-semibold"
          text={block.title}
          path={`${pathPrefix}title`}
        />
      ) : null}
      <Annotatable {...anchor} as="p" text={block.text} path={`${pathPrefix}text`} />
    </aside>
  )
}
