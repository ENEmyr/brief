import type { Block } from '@brief/schema'
import type { CSSProperties } from 'react'
import { Annotatable } from '@/features/annotations'
import type { Highlight } from '@/features/reader-state'
import { BlockCard, cardHeader } from '../BlockCard'

// The payload keeps its Catppuccin tone names (renaming them would break
// payloads); each maps to the data hue tokens.css defines for it.
const statToneClass = {
  mauve: 'text-data-mauve',
  blue: 'text-data-blue',
  green: 'text-data-green',
  red: 'text-data-red',
  peach: 'text-data-peach',
  teal: 'text-data-teal',
  yellow: 'text-data-yellow',
} as const

export function Stats({
  block,
  sid,
  bid,
  pathPrefix = '',
  annotatable = true,
  onMarkClick,
}: {
  block: Extract<Block, { type: 'stat' }>
  sid?: number
  bid?: number
  pathPrefix?: string
  annotatable?: boolean
  onMarkClick?: (highlight: Highlight) => void
}) {
  const style = { '--stat-cols': `repeat(${Math.min(4, block.items.length)}, 1fr)` } as CSSProperties
  const anchor = {
    sid,
    bid: bid ?? null,
    annotatable: annotatable && bid !== undefined,
    onMarkClick,
  }

  return (
    <BlockCard {...cardHeader(block, { sid, bid, pathPrefix, annotatable, onMarkClick })}>
      <div
        className="grid grid-cols-2 gap-3 p-3 min-[880px]:[grid-template-columns:var(--stat-cols)]"
        style={style}
      >
        {block.items.map((item, i) => (
          <div key={i} className="border border-line rounded-xl bg-card px-4 py-[15px] text-center">
            <Annotatable
              {...anchor}
              as="p"
              className={`text-[28px] font-bold font-mono leading-none ${statToneClass[item.tone ?? 'mauve']}`}
              text={item.value}
              path={`${pathPrefix}items.${i}.value`}
            />
            <Annotatable
              {...anchor}
              as="p"
              className="text-[12px] text-sub mt-1.5 leading-[1.4]"
              text={item.label}
              path={`${pathPrefix}items.${i}.label`}
            />
            {item.hint && (
              <Annotatable
                {...anchor}
                as="p"
                className="text-[11px] text-faint mt-1"
                text={item.hint}
                path={`${pathPrefix}items.${i}.hint`}
              />
            )}
          </div>
        ))}
      </div>
    </BlockCard>
  )
}
