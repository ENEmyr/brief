import type { Block } from '@brief/schema'
import type { CSSProperties } from 'react'
import { Annotatable } from '@/features/annotations'
import type { Highlight } from '@/features/reader-state'

const statToneClass = {
  mauve: 'text-mauve',
  blue: 'text-blue',
  green: 'text-green',
  red: 'text-red',
  peach: 'text-peach',
  teal: 'text-teal',
  yellow: 'text-yellow',
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
    <div
      className="grid grid-cols-2 gap-3 my-4 min-[880px]:[grid-template-columns:var(--stat-cols)]"
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
  )
}
