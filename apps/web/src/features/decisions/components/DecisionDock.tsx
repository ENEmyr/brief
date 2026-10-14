'use client'
import { useEffect, useId, useRef, useState } from 'react'
import type { Decision } from '@brief/schema'
import { useReaderActions, useReaderState } from '@/features/reader-state'
import { modKeyLabel } from '@/features/shortcuts'
import { decisionCounts, isAnswered } from '../lib/answers'
import { DecisionSegments } from './DecisionSegments'
import { OptionList } from './OptionList'
import { ResetAnswers } from './ResetAnswers'
import { SupportTabs } from './SupportTabs'
import type { TabKey } from './SupportTabs'

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line'

/** Which decision the shell asked to show; `seq` repeats a request for the same one. */
export interface DockTarget {
  id: string
  seq: number
}

/** "Includes answers, reasons and N notes": N counts the `Note:` lines the prompt prints. */
function includesLine(notes: number): string {
  return `Includes answers, reasons and ${notes} ${notes === 1 ? 'note' : 'notes'}`
}

function DockDecision({ decision, current }: { decision: Decision; current: boolean }) {
  const state = useReaderState()
  const actions = useReaderActions()
  const questionId = useId()
  const [tab, setTab] = useState<TabKey>()
  const done = isAnswered(decision, state)
  let word = 'open'
  if (done) word = 'done'
  else if (decision.multi) word = 'multi'

  return (
    <div
      role="group"
      aria-label={`Question ${decision.id}`}
      data-decision={decision.id}
      className={`flex flex-col gap-2 border-b border-line px-[14px] py-3 max-[1101px]:scroll-mt-[72px] ${current ? 'bg-[var(--c-dock-current)]' : ''}`}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[11px] text-accent-text">{decision.id}</span>
        <span id={questionId} className="grow text-[14px] font-semibold leading-5">
          {decision.q}
        </span>
        <span className={`font-mono text-[10px] ${done ? 'text-good' : 'text-warn'}`}>{word}</span>
      </div>
      <OptionList decision={decision} variant="dock" labelledBy={questionId} />
      {/* B-Reader draws an input 32 high plus its border; a one-row textarea looks
          the same and, unlike an input, keeps the line breaks of a reason typed before. */}
      <textarea
        rows={1}
        value={state.dnote[decision.id] ?? ''}
        onChange={(event) => actions.setDecisionNote(decision.id, event.target.value)}
        aria-label={`${decision.id} Reason`}
        placeholder="Reason / extra context (optional)"
        className={`block min-h-[34px] resize-none rounded-[4px] border border-line bg-[var(--c-code-bg)] px-[10px] py-1 text-[16px] leading-6 text-text outline-none [field-sizing:content] ${FOCUS_RING}`}
      />
      <SupportTabs decision={decision} picked={tab} onPick={setTab} />
    </div>
  )
}

/**
 * The decision dock as a column (B-Reader:205-231): DECISIONS a/n with the
 * segmented bar, every decision expanded with the first open one on the
 * highlight fill (owner ruling D1), then "Copy prompt for agent" and what the
 * prompt includes. A new `target` scrolls its decision into view and focuses
 * its tab stop, so N and "Go to Dn" land where the reader can answer.
 */
export function DecisionDock({
  decisions,
  target,
  onCopyPrompt,
}: {
  decisions: Decision[]
  target: DockTarget | null
  onCopyPrompt: () => void
}) {
  const state = useReaderState()
  const rootRef = useRef<HTMLDivElement>(null)
  // Only a target set while mounted moves focus, not one left over from the sheet.
  const handledSeq = useRef(target?.seq)
  const { answered, notes } = decisionCounts(decisions, state)
  const firstOpen = decisions.find((d) => !isAnswered(d, state))
  const mod = modKeyLabel()

  useEffect(() => {
    if (!target || target.seq === handledSeq.current) return
    handledSeq.current = target.seq
    const row = [...(rootRef.current?.querySelectorAll<HTMLElement>('[data-decision]') ?? [])].find(
      (el) => el.dataset.decision === target.id,
    )
    if (!row?.parentElement) return
    const list = row.parentElement
    // 'nearest' aligns the bottom of a row taller than the list, which leaves its question
    // and first options above the list's top edge; show such a row from its top instead.
    // Only the list scrolls: scrollIntoView would also move the page under the sticky dock.
    if (row.offsetHeight > list.clientHeight) {
      list.scrollTop += row.getBoundingClientRect().top - list.getBoundingClientRect().top
    } else {
      row.scrollIntoView({ block: 'nearest' })
    }
    const option = row.querySelector<HTMLElement>('[role="radio"][tabindex="0"], [role="checkbox"]')
    option?.scrollIntoView({ block: 'nearest' })
    option?.focus({ preventScroll: true })
  }, [target])

  if (decisions.length === 0) return null

  return (
    <div ref={rootRef} className="flex min-h-0 grow flex-col leading-[normal]">
      <div className="flex shrink-0 flex-col gap-2 border-b border-line px-[14px] py-3">
        <div className="flex items-center gap-2">
          <span className="grow font-mono text-[11px] tracking-[.06em] text-faint">DECISIONS</span>
          <span className="font-mono text-[12px] text-accent-text">
            {answered}/{decisions.length}
          </span>
        </div>
        <DecisionSegments decisions={decisions} state={state} />
      </div>
      <div className="flex min-h-0 flex-col overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--c-line)_transparent]">
        {decisions.map((d) => (
          <DockDecision key={d.id} decision={d} current={d === firstOpen} />
        ))}
      </div>
      <div className="flex shrink-0 flex-col gap-2 px-[14px] py-3">
        <button
          type="button"
          onClick={onCopyPrompt}
          className={`flex min-h-10 items-center justify-center gap-2 rounded-[4px] border-0 bg-accent text-[14px] font-semibold text-on-accent transition-transform duration-[var(--dur-fast)] active:scale-[.97] motion-reduce:transition-none ${FOCUS_RING}`}
        >
          Copy prompt for agent
          <kbd className="font-mono text-[11px] opacity-70">{mod === '⌘' ? '⌘↵' : 'Ctrl ↵'}</kbd>
        </button>
        <span className="text-center text-[12px] leading-[18px] text-faint">
          {includesLine(notes)}
        </span>
        <ResetAnswers decisions={decisions} variant="dock" />
      </div>
    </div>
  )
}
