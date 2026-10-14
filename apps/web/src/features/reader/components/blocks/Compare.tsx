import type { Block } from '@brief/schema'
import { Annotatable } from '@/features/annotations'
import type { Highlight } from '@/features/reader-state'
import { BlockCard, cardHeader } from '../BlockCard'

// B-Blocks:54, :58: the tone lives in the tag. An untoned tag takes the
// neutral chip, which no board draws.
const tagTone = {
  good: 'bg-good-soft text-good',
  bad: 'bg-bad-soft text-bad',
} as const

export function Compare({
  block,
  sid,
  bid,
  pathPrefix = '',
  annotatable = true,
  onMarkClick,
}: {
  block: Extract<Block, { type: 'compare' }>
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
      <div className="grid grid-cols-2 max-[880px]:grid-cols-1">
        {[
          { side: 'left', data: block.left },
          { side: 'right', data: block.right },
        ].map(({ side, data }) => (
          <div
            key={side}
            className={`flex min-w-0 flex-col ${side === 'left' ? 'border-r border-line max-[880px]:border-r-0 max-[880px]:border-b' : ''}`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
              <Annotatable
                {...anchor}
                as="div"
                className="min-w-0 break-words text-[14px] font-semibold leading-[normal] text-text"
                text={data.title}
                path={`${pathPrefix}${side}.title`}
              />
              {data.tag && (
                <span
                  className={`shrink-0 rounded-[3px] px-1.5 py-px text-[11px] leading-[normal] ${data.tone ? tagTone[data.tone] : 'bg-chip text-sub'}`}
                >
                  {data.tag}
                </span>
              )}
            </div>
            <ul className="m-0 flex list-none flex-col gap-1.5 px-3.5 py-2 text-[14px] leading-[22px] text-text">
              {data.items.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className={`shrink-0 font-mono ${item.ok ? 'text-good' : 'text-bad'}`}>
                    {item.ok ? '✓' : '✗'}
                  </span>
                  <Annotatable
                    {...anchor}
                    className="min-w-0 break-words"
                    text={item.text}
                    path={`${pathPrefix}${side}.items.${i}.text`}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </BlockCard>
  )
}
