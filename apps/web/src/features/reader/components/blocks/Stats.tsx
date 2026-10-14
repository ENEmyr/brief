'use client'
import { useMemo } from 'react'
import type { Block } from '@brief/schema'
import { Annotatable } from '@/features/annotations'
import type { Highlight } from '@/features/reader-state'
import { BlockCard, cardHeader } from '../BlockCard'
import {
  formatStatNumber,
  parseStatNumber,
  useCountUp,
  type CountPhase,
  type StatNumber,
} from './countUp'

type StatItem = Extract<Block, { type: 'stat' }>['items'][number]

// The payload keeps its Catppuccin tone names (renaming them would break
// payloads); each maps to the data hue tokens.css defines for it (B3). A
// value with no tone is plain text (B-Blocks:43).
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
  const anchor = {
    sid,
    bid: bid ?? null,
    annotatable: annotatable && bid !== undefined,
    onMarkClick,
  }
  const numbers = useMemo(
    () => block.items.map((item) => parseStatNumber(item.value)),
    [block.items],
  )
  const { ref, phase, progress } = useCountUp(
    block,
    numbers.some((n) => n !== null),
  )
  const columns = block.items.length > 1 ? 2 : 1
  const lastRowStart = block.items.length - (block.items.length % columns || columns)

  return (
    <BlockCard {...cardHeader(block, { sid, bid, pathPrefix, annotatable, onMarkClick })}>
      {/* B-Blocks:42-47: cells in two columns, split by line rules. */}
      <div ref={ref} className={`grid ${columns === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {block.items.map((item, i) => (
          <div
            key={i}
            className={`flex min-w-0 flex-col gap-1.5 p-3.5 ${
              columns === 2 && i % 2 === 0 && i < block.items.length - 1
                ? 'border-r border-line'
                : ''
            } ${i < lastRowStart ? 'border-b border-line' : ''}`}
          >
            <Annotatable
              {...anchor}
              className="break-words text-[12px] leading-[normal] text-sub"
              text={item.label}
              path={`${pathPrefix}items.${i}.label`}
            />
            <StatValue
              item={item}
              number={numbers[i] ?? null}
              index={i}
              pathPrefix={pathPrefix}
              anchor={anchor}
              phase={phase}
              progress={progress}
            />
            {item.hint && (
              <Annotatable
                {...anchor}
                className="break-words font-mono text-[12px] leading-[normal] text-faint"
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

/**
 * The value stays one annotatable leaf holding the agent's own text, so a
 * highlight always anchors to it. While the count runs, that leaf is hidden
 * and a plain copy shows the rising number in the same grid cell, so the
 * cell keeps its final size. Before the stat is first on screen the value is
 * hidden (it is off screen), except on paper.
 */
function StatValue({
  item,
  number,
  index,
  pathPrefix,
  anchor,
  phase,
  progress,
}: {
  item: StatItem
  number: StatNumber | null
  index: number
  pathPrefix: string
  anchor: {
    sid?: number
    bid: number | null
    annotatable: boolean
    onMarkClick?: (highlight: Highlight) => void
  }
  phase: CountPhase
  progress: number
}) {
  const pending = number !== null && phase !== 'done'
  const tone = item.tone ? statToneClass[item.tone] : 'text-text'
  return (
    <div className="grid font-mono text-[28px] font-medium leading-8">
      <Annotatable
        {...anchor}
        className={`break-words [grid-area:1/1] ${tone} ${pending ? 'invisible print:visible' : ''}`}
        text={item.value}
        path={`${pathPrefix}items.${index}.value`}
      />
      {number !== null && phase === 'counting' ? (
        <span aria-hidden="true" data-count-up className={`[grid-area:1/1] print:hidden ${tone}`}>
          {formatStatNumber(number, progress)}
        </span>
      ) : null}
    </div>
  )
}
