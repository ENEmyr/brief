import type { Block } from '@brief/schema'
import { Annotatable } from '@/features/annotations'
import type { Highlight } from '@/features/reader-state'

const paneBorderTop = {
  good: 'border-t-good',
  bad: 'border-t-bad',
} as const

const tagPillTone = {
  good: 'text-good border-good bg-good-soft',
  bad: 'text-bad border-bad bg-bad-soft',
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
    <figure className="my-4">
      <figcaption className="font-mono text-[10.5px] tracking-[.04em] text-faint mb-2">
        {block.caption ? (
          <Annotatable {...anchor} text={block.caption} path={`${pathPrefix}caption`} />
        ) : (
          'Comparison'
        )}
      </figcaption>
      <div className="flex gap-3.5 items-stretch max-[880px]:flex-col">
        {[
          { side: 'left', data: block.left },
          { side: 'right', data: block.right },
        ].map(({ side, data }) => (
          <div
            key={side}
            className={`flex-1 min-w-0 border border-line border-t-[3px] ${data.tone ? paneBorderTop[data.tone] : 'border-t-accent-line'} rounded-xl bg-card px-[17px] py-[15px]`}
          >
            <div className="flex items-center gap-2 mb-[11px]">
              <Annotatable
                {...anchor}
                as="div"
                className="text-[14.5px] font-bold text-text"
                text={data.title}
                path={`${pathPrefix}${side}.title`}
              />
              {data.tag && (
                <span
                  className={`font-mono text-[10.5px] font-semibold rounded-full px-2.5 py-0.5 border ${data.tone ? tagPillTone[data.tone] : 'text-accent-text border-accent-line bg-accent-soft'}`}
                >
                  {data.tag}
                </span>
              )}
            </div>
            <ul className="flex flex-col gap-2">
              {data.items.map((item, i) => (
                <li key={i} className="flex gap-2 text-[13px] leading-[1.55] text-text">
                  <span className={`flex-none font-bold ${item.ok ? 'text-good' : 'text-bad'}`}>
                    {item.ok ? '✓' : '✕'}
                  </span>
                  <Annotatable
                    {...anchor}
                    text={item.text}
                    path={`${pathPrefix}${side}.items.${i}.text`}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </figure>
  )
}
