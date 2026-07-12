import type { Block } from '@brief/schema'
import { Annotatable } from '@/features/annotations'
import type { Highlight } from '@/features/reader-state'

const barFill = {
  full: 'bg-green w-full',
  partial: 'bg-peach w-1/2',
  missing: 'bg-red w-[8%]',
} as const

const legend = [
  { status: 'full', color: 'bg-green' },
  { status: 'partial', color: 'bg-peach' },
  { status: 'missing', color: 'bg-red' },
] as const

export function Coverage({
  block,
  sid,
  bid,
  pathPrefix = '',
  annotatable = true,
  onMarkClick,
}: {
  block: Extract<Block, { type: 'coverage' }>
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
      <figcaption className="font-mono text-[10.5px] tracking-[.04em] text-faint mb-2.5">
        {block.caption ? (
          <Annotatable {...anchor} text={block.caption} path={`${pathPrefix}caption`} />
        ) : (
          'Coverage'
        )}
      </figcaption>
      {block.items.map((item, i) => (
        <div
          key={i}
          className="grid grid-cols-1 min-[880px]:grid-cols-[minmax(0,190px)_1fr_minmax(0,160px)] items-center gap-2.5 mb-2 text-[12.5px]"
        >
          <Annotatable
            {...anchor}
            className="break-words font-semibold text-text"
            text={item.label}
            path={`${pathPrefix}items.${i}.label`}
          />
          <div
            role="img"
            aria-label={`${item.label}: ${item.status}`}
            className="flex h-4 rounded-md overflow-hidden bg-chip"
          >
            <div className={`h-full ${barFill[item.status]}`} />
          </div>
          {/* No whitespace-nowrap: a long note (an unspaced Thai run, say) has
              nowhere to go in a fixed column and paints straight out of the
              figure. Let it wrap, and break the run if it has no break points. */}
          <Annotatable
            {...anchor}
            className="hidden break-words min-[880px]:block font-mono text-[11px] text-sub text-right"
            text={item.note ?? ''}
            path={`${pathPrefix}items.${i}.note`}
          />
        </div>
      ))}
      <div className="flex gap-3.5 mt-2 text-[11px] text-faint">
        {legend.map((l) => (
          <span key={l.status} className="flex items-center gap-1">
            <span className={`inline-block w-[9px] h-[9px] rounded-sm ${l.color}`} />
            {l.status}
          </span>
        ))}
      </div>
    </figure>
  )
}
