import type { Block } from '@brief/schema'
import { Annotatable } from '@/features/annotations'
import type { Highlight } from '@/features/reader-state'
import { BlockCard, cardHeader } from '../BlockCard'

type Status = Extract<Block, { type: 'coverage' }>['items'][number]['status']

const FILLED = 'bg-good'
const PART = 'bg-[var(--c-warn-fill)]'
const EMPTY = 'bg-line'
const NONE = 'box-border border border-dashed border-bad'

/**
 * B-Blocks:67-70. Each status has its own bar of four segments and its own
 * word, so no two statuses look alike (bug-093, bug-094: every row once drew
 * the same full bar). The percent in the header counts full as 1 and part as
 * one half (owner decision D3: derived, no field).
 */
const STATUS: Record<
  Status,
  { word: string; color: string; segments: readonly string[]; weight: number }
> = {
  full: { word: 'full', color: 'text-good', segments: [FILLED, FILLED, FILLED, FILLED], weight: 1 },
  partial: { word: 'part', color: 'text-warn', segments: [PART, PART, EMPTY, EMPTY], weight: 0.5 },
  missing: { word: 'none', color: 'text-bad', segments: [NONE, NONE, NONE, NONE], weight: 0 },
}

function coveragePercent(statuses: readonly Status[]): number {
  if (statuses.length === 0) return 0
  return Math.round(
    (statuses.reduce((sum, s) => sum + STATUS[s].weight, 0) / statuses.length) * 100,
  )
}

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
    <BlockCard
      {...cardHeader(block, { sid, bid, pathPrefix, annotatable, onMarkClick })}
      meta={
        <span className="shrink-0 text-sub">
          {coveragePercent(block.items.map((item) => item.status))}%
        </span>
      }
    >
      <div className="py-1.5">
        {block.items.map((item, i) => {
          const status = STATUS[item.status]
          return (
            <div
              key={i}
              className="grid grid-cols-[minmax(0,1fr)_120px_44px] items-center gap-3 px-3.5 py-[7px] text-[14px] leading-[normal]"
            >
              <div className="min-w-0">
                <Annotatable
                  {...anchor}
                  className="break-words"
                  text={item.label}
                  path={`${pathPrefix}items.${i}.label`}
                />
                {/* No board draws the note; it sits under its label as small sub text. */}
                {item.note ? (
                  <Annotatable
                    {...anchor}
                    as="div"
                    className="mt-0.5 break-words text-[12px] text-sub"
                    text={item.note}
                    path={`${pathPrefix}items.${i}.note`}
                  />
                ) : null}
              </div>
              <span
                role="img"
                aria-label={`${item.label}: ${item.status}`}
                className="flex gap-0.5"
              >
                {status.segments.map((segment, j) => (
                  <span key={j} className={`h-2.5 flex-1 ${segment}`} />
                ))}
              </span>
              <span className={`font-mono text-[12px] ${status.color}`}>{status.word}</span>
            </div>
          )
        })}
      </div>
    </BlockCard>
  )
}
