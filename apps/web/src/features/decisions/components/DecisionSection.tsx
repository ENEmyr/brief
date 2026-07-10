'use client'
import { useState } from 'react'
import type { Decision } from '@brief/schema'
import { useReaderActions, useReaderState } from '@/features/reader-state'
import { DecisionCard } from './DecisionCard'

const pad = (n: number) => String(n).padStart(2, '0')

function isAnswered(decision: Decision, dsel: Record<string, string[]>): boolean {
  return (dsel[decision.id]?.length ?? 0) > 0
}

/** Decisions section (Reader.dc.html 756-779): a stepper over `decisions`
 * showing one DecisionCard at a time, a progress bar + jump buttons, and a
 * nav row (Previous/Next, Reset once anything is answered, and a locked
 * "answer N more" hint that flips to a Generate prompt button once every
 * question has a selection). The current question index is local, transient
 * UI state -- it is not persisted, matching the prototype. Answers/notes
 * live in the reader-state store via useReaderState/useReaderActions.
 * `support` and `onGeneratePrompt` are placeholders for Task 5 (why/compare/
 * diagram tabs and the actual prompt builder); `onReset` is a toast hook,
 * no-op by default. */
export function DecisionSection({
  decisions,
  no,
  support,
  onGeneratePrompt,
  onReset,
}: {
  decisions: Decision[]
  no: number
  support?: React.ReactNode
  onGeneratePrompt?: () => void
  onReset?: () => void
}) {
  const { dsel, dnote } = useReaderState()
  const actions = useReaderActions()
  const [curQ, setCurQ] = useState(0)

  if (decisions.length === 0) return null

  const total = decisions.length
  const index = Math.min(curQ, total - 1)
  const current = decisions[index]!
  const done = decisions.filter((d) => isAnswered(d, dsel)).length
  const allAnswered = done === total

  function goQ(target: number) {
    setCurQ(Math.max(0, Math.min(total - 1, target)))
  }

  function handleReset() {
    actions.resetDecisions()
    onReset?.()
  }

  return (
    <section id="decide" data-section="decide" className="mt-4 scroll-mt-[76px]">
      <h2 className="mb-1.5 border-b-2 border-mauvesoft pb-2 text-[21px] font-bold">
        <span className="mr-2 font-mono text-[16px] text-mauve">{pad(no)}</span>
        Decisions
      </h2>
      <p className="mb-4 text-[13.5px] text-sub">
        Answer every question to unlock prompt generation for Claude Code to continue
      </p>

      <div className="mb-4 flex items-center gap-3">
        <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-chip">
          <div
            role="progressbar"
            aria-label="Decisions answered"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            className="h-full rounded-full bg-mauve transition-[width]"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
        <span
          className={`font-mono text-[12px] font-semibold ${done === total ? 'text-green' : 'text-sub'}`}
        >
          Answered {done}/{total}
        </span>
        <div className="flex gap-1">
          {decisions.map((d, i) => {
            const answered = isAnswered(d, dsel)
            const active = i === index
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => goQ(i)}
                aria-label={`Question ${d.id}`}
                aria-current={active ? 'true' : undefined}
                className={`h-[26px] w-[26px] rounded-[7px] border font-mono text-[10.5px] max-[879px]:min-h-11 max-[879px]:min-w-11 ${
                  active ? 'border-mauve font-bold' : 'border-line font-normal'
                } ${answered ? 'bg-mauvesoft text-mauve' : 'bg-card text-faint'}`}
              >
                {d.id.slice(1)}
              </button>
            )
          })}
        </div>
      </div>

      <DecisionCard
        decision={current}
        selectedIds={dsel[current.id] ?? []}
        note={dnote[current.id] ?? ''}
        onPick={(optionId) => actions.pickOption(current.id, optionId, current.multi)}
        onNoteChange={(text) => actions.setDecisionNote(current.id, text)}
        support={support}
      />

      <div className="mt-3.5 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => goQ(index - 1)}
          disabled={index === 0}
          className="max-[879px]:min-h-11 rounded-[9px] border border-line bg-card px-4 py-[9px] text-[13.5px] font-semibold text-text disabled:bg-elev disabled:text-faint"
        >
          ‹ Previous
        </button>
        <button
          type="button"
          onClick={() => goQ(index + 1)}
          disabled={index === total - 1}
          className="max-[879px]:min-h-11 rounded-[9px] border border-line bg-card px-4 py-[9px] text-[13.5px] font-semibold text-text disabled:bg-elev disabled:text-faint"
        >
          Next ›
        </button>
        {done > 0 && (
          <button
            type="button"
            onClick={handleReset}
            title="Clear all answers"
            className="max-[879px]:min-h-11 rounded-[9px] border border-line bg-card px-3.5 py-[9px] text-[13px] font-semibold text-red"
          >
            ↺ Reset
          </button>
        )}
        <div className="ml-auto">
          {allAnswered ? (
            <button
              type="button"
              onClick={() => onGeneratePrompt?.()}
              className="max-[879px]:min-h-11 rounded-[9px] bg-mauve px-5 py-2.5 text-[14px] font-bold text-white shadow-[var(--shadow-mauve-glow)]"
            >
              ✦ Generate prompt
            </button>
          ) : (
            <span className="text-[12.5px] text-faint">
              Answer {total - done} more to generate a prompt
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
