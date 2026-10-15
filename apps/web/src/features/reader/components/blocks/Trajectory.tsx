'use client'
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import type { TrajectoryBlock } from '@brief/schema'
import { useReaderActions, useReaderState, type TrajectoryMark } from '@/features/reader-state'
import {
  KIND_LABEL,
  MARK_LABEL,
  durationLabel,
  offsetLabel,
  tokensLabel,
  totalSeconds,
  trajectoryKey,
} from '@/features/trajectory'
import { BlockCard, cardHeader } from '../BlockCard'
import type { BlockAnchor } from '../blockAnchor'
import { FOCUS_RING } from '../topbarChrome'

type Step = TrajectoryBlock['steps'][number]
type Kind = Step['kind']

// B-NewBlocks:258-263. A filled dot marks what the reader or the agent did;
// a hollow one, what the agent looked at or took for granted.
const KIND_STYLE: Record<Kind, { color: string; filled: boolean }> = {
  request: { color: 'text-text', filled: true },
  read: { color: 'text-faint', filled: false },
  run: { color: 'text-faint', filled: false },
  decision: { color: 'text-info', filled: true },
  assumption: { color: 'text-warn', filled: false },
  edit: { color: 'text-good', filled: true },
  note: { color: 'text-faint', filled: false },
}

// B-NewBlocks:301-302: reads and bash share one filter.
const FILTERS = [
  { id: 'all', label: 'all', kinds: null },
  { id: 'decision', label: 'decided', kinds: ['decision'] },
  { id: 'assumption', label: 'assumed', kinds: ['assumption'] },
  { id: 'edit', label: 'edits', kinds: ['edit'] },
  { id: 'read', label: 'reads + bash', kinds: ['read', 'run'] },
] as const satisfies readonly { id: string; label: string; kinds: readonly Kind[] | null }[]

type FilterId = (typeof FILTERS)[number]['id']

function matches(filter: (typeof FILTERS)[number], kind: Kind): boolean {
  return filter.kinds === null || (filter.kinds as readonly Kind[]).includes(kind)
}

const BUTTON = `min-h-[30px] rounded-[4px] px-2.5 text-[12px] max-[880px]:min-h-11 max-[880px]:min-w-11 print:hidden ${FOCUS_RING}`
const PRESSED = 'border border-accent-line bg-accent-soft text-accent-text'
const IDLE = 'border border-line2 bg-transparent text-text'

export function Trajectory({ block, ...anchor }: { block: TrajectoryBlock } & BlockAnchor) {
  const { sid, bid, pathPrefix = '' } = anchor
  const key = sid === undefined || bid === undefined ? undefined : trajectoryKey(sid, bid, pathPrefix)
  const marks = useReaderState().tflag?.[key ?? ''] ?? {}
  const { setStepMark } = useReaderActions()
  const [filterId, setFilterId] = useState<FilterId>('all')
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const listId = useId()

  const first = block.steps[0]
  const count = (kinds: readonly Kind[]) => block.steps.filter((s) => kinds.includes(s.kind)).length
  const decided = count(['decision'])
  const assumed = count(['assumption'])
  const tokens = block.stats?.tokens
  const filters = FILTERS.map((f) => ({ ...f, n: f.kinds === null ? block.steps.length : count(f.kinds) })).filter(
    (f) => f.kinds === null || f.n > 0,
  )
  const active = FILTERS.find((f) => f.id === filterId) ?? FILTERS[0]

  function onTabKey(event: KeyboardEvent, index: number) {
    const last = filters.length - 1
    const next = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[
      event.key
    ]
    const target = next === undefined ? undefined : filters[next]
    if (next === undefined || !target) return
    event.preventDefault()
    setFilterId(target.id)
    tabs.current[next]?.focus()
  }

  function mark(step: number, value: TrajectoryMark) {
    if (key === undefined) return
    setStepMark(key, step, marks[String(step)] === value ? null : value)
  }

  return (
    <BlockCard
      {...cardHeader(block, anchor)}
      captionSuffix={
        <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
          <span>{block.steps.length} steps</span>
          <span>{durationLabel(totalSeconds(block))}</span>
          {tokens === undefined ? null : <span>{tokensLabel(tokens)}</span>}
          {decided > 0 ? <span className="text-info">{decided} decided alone</span> : null}
          {assumed > 0 ? (
            <span className="text-warn">
              {assumed} {assumed === 1 ? 'assumption' : 'assumptions'}
            </span>
          ) : null}
        </span>
      }
    >
      <div role="tablist" aria-label="Filter" className="flex flex-wrap gap-[2px] border-b border-line px-2 py-1.5">
        {filters.map((f, i) => {
          const on = f.id === active.id
          return (
            <button
              key={f.id}
              ref={(el) => {
                tabs.current[i] = el
              }}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={listId}
              tabIndex={on ? 0 : -1}
              onClick={() => setFilterId(f.id)}
              onKeyDown={(event) => onTabKey(event, i)}
              className={`min-h-[30px] rounded-[4px] px-2.5 text-[12px] max-[880px]:min-h-11 max-[880px]:min-w-11 ${FOCUS_RING} ${
                on ? 'bg-chip text-text' : 'bg-transparent text-faint'
              }`}
            >
              {f.label} {f.n}
            </button>
          )
        })}
      </div>
      <div id={listId} role="tabpanel" aria-label="Steps" className="flex flex-col text-[13px]">
        {block.steps.map((step, i) =>
          matches(active, step.kind) ? (
            <StepRow
              key={i}
              step={step}
              offset={first ? offsetLabel(step.at, first.at) : ''}
              mark={marks[String(i)]}
              onMark={key === undefined ? undefined : (value) => mark(i, value)}
            />
          ) : null,
        )}
      </div>
    </BlockCard>
  )
}

function StepRow({
  step,
  offset,
  mark,
  onMark,
}: {
  step: Step
  offset: string
  mark: TrajectoryMark | undefined
  onMark: ((value: TrajectoryMark) => void) | undefined
}) {
  const kind = KIND_STYLE[step.kind]
  const tint = step.flag ? (step.kind === 'assumption' ? 'bg-[var(--c-warn-callout)]' : 'bg-[var(--c-info-callout)]') : ''
  return (
    <div
      data-step-kind={step.kind}
      className={`grid grid-cols-[56px_110px_minmax(0,1fr)_auto] items-start gap-3 border-b border-[var(--c-grid-line)] px-3 py-2.5 max-[880px]:grid-cols-[56px_minmax(0,1fr)] max-[880px]:gap-y-1.5 ${tint}`}
    >
      <time dateTime={step.at} title={step.at} className="pt-px font-mono text-[12px] text-faint">
        {offset}
      </time>
      <span className={`flex items-center gap-1.5 pt-0.5 font-mono text-[11px] ${kind.color}`}>
        <span
          aria-hidden="true"
          className={`size-[7px] shrink-0 rounded-full border-[1.5px] border-current ${kind.filled ? 'bg-current' : ''}`}
        />
        {KIND_LABEL[step.kind]}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5 break-words max-[880px]:col-start-2">
        <span className="font-medium">{step.title}</span>
        {step.detail ? <span className="text-[12px] leading-[18px] text-sub">{step.detail}</span> : null}
      </div>
      {step.flag && onMark ? (
        <div role="group" aria-label={step.title} className="flex gap-1.5 max-[880px]:col-start-2">
          {(['ask', 'ok'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mark === value}
              onClick={() => onMark(value)}
              className={`${BUTTON} ${value === 'ask' ? 'font-semibold' : ''} ${
                mark === value ? PRESSED : value === 'ask' && mark === undefined ? 'bg-accent text-on-accent' : IDLE
              }`}
            >
              {MARK_LABEL[value]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
