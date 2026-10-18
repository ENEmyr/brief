'use client'
import { useEffect, useId, useRef, useState } from 'react'
import type { Decision, StoredSection } from '@brief/schema'
import { useReaderActions, useReaderState } from '@/features/reader-state'
import { isAnswered } from '../lib/answers'
import type { DockTarget } from './DecisionDock'
import { OptionList } from './OptionList'
import { RefChips } from './RefChips'
import type { JumpToContext } from './RefChips'
import { SupportTabs } from './SupportTabs'
import type { TabKey } from './SupportTabs'

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line'

/**
 * The dock as B-Mobile's bottom sheet (B-Mobile:64-92): a chip per decision,
 * then the current one alone, then "Copy prompt for agent". The chips are 44
 * high where the board draws 36: every target under 880 is at least 44.
 * `target` picks the question; a new `seq` (N, "Go to") also focuses it, a chip
 * keeps focus on itself.
 */
export function DecisionSheet({
  decisions,
  sections,
  target,
  onSelect,
  onCopyPrompt,
  onJumpToContext,
}: {
  decisions: Decision[]
  sections?: readonly StoredSection[]
  target: DockTarget | null
  onSelect: (id: string) => void
  onCopyPrompt: () => void
  onJumpToContext?: JumpToContext
}) {
  const state = useReaderState()
  const actions = useReaderActions()
  const questionId = useId()
  const reasonId = useId()
  const answeredId = useId()
  const bodyRef = useRef<HTMLDivElement>(null)
  const [tabs, setTabs] = useState<Partial<Record<string, TabKey>>>({})
  // A chip keeps the request number (0 before any), so only N and "Go to" move focus.
  const handledSeq = useRef(target?.seq ?? 0)
  const current = decisions.find((d) => d.id === target?.id) ?? decisions[0]!

  useEffect(() => {
    if (!target || target.seq === handledSeq.current) return
    handledSeq.current = target.seq
    bodyRef.current
      ?.querySelector<HTMLElement>('[role="radio"][tabindex="0"], [role="checkbox"]')
      ?.focus()
  }, [target])

  return (
    <>
      <div className="flex shrink-0 gap-[6px] overflow-x-auto px-[14px] py-[10px]">
        {decisions.map((d) => {
          const on = d.id === current.id
          const done = isAnswered(d, state)
          let tone = done
            ? 'border-line2 bg-transparent text-text'
            : 'border-line2 bg-transparent text-sub'
          if (on) tone = 'border-accent-line bg-accent-soft text-accent-text'
          return (
            <button
              key={d.id}
              type="button"
              aria-pressed={on}
              aria-label={`Question ${d.id}`}
              aria-describedby={done ? answeredId : undefined}
              onClick={() => onSelect(d.id)}
              className={`min-h-11 shrink-0 rounded-[999px] border px-3 font-mono text-[12px] ${tone} ${FOCUS_RING}`}
            >
              {d.id}
              {done && ' ✓'}
            </button>
          )
        })}
        <span id={answeredId} hidden>
          answered
        </span>
      </div>
      <div ref={bodyRef} className="min-h-0 grow overflow-y-auto px-[14px] pb-[14px] pt-[6px]">
        <div
          key={current.id}
          role="group"
          aria-label={`Question ${current.id}`}
          data-decision={current.id}
          className="flex flex-col gap-[10px]"
        >
          <span id={questionId} className="text-[18px] font-semibold leading-[26px]">
            {current.q}
          </span>
          {onJumpToContext && sections && (
            <RefChips decision={current} sections={sections} onJump={onJumpToContext} variant="sheet" />
          )}
          <OptionList decision={current} variant="sheet" labelledBy={questionId} />
          <label htmlFor={reasonId} className="text-[13px] leading-[normal] text-sub">
            Reason / extra context
          </label>
          <textarea
            id={reasonId}
            rows={2}
            value={state.dnote[current.id] ?? ''}
            onChange={(event) => actions.setDecisionNote(current.id, event.target.value)}
            placeholder="optional"
            className={`-mt-1 resize-none rounded-[6px] border border-line bg-[var(--c-code-bg)] px-3 py-2 text-[16px] leading-6 text-text outline-none ${FOCUS_RING}`}
          />
          <SupportTabs
            decision={current}
            picked={tabs[current.id]}
            onPick={(key) => setTabs((prev) => ({ ...prev, [current.id]: key }))}
          />
        </div>
      </div>
      <div className="shrink-0 border-t border-line px-3 pb-[30px] pt-[10px]">
        <button
          type="button"
          onClick={onCopyPrompt}
          className={`min-h-12 w-full rounded-[6px] border-0 bg-accent text-[15px] font-semibold leading-[normal] text-on-accent transition-transform duration-[var(--dur-fast)] active:scale-[.97] motion-reduce:transition-none ${FOCUS_RING}`}
        >
          Copy prompt for agent
        </button>
      </div>
    </>
  )
}
