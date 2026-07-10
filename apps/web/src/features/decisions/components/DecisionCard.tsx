'use client'
import type { Decision } from '@brief/schema'

/** One decision question (Reader.dc.html 781-797): id pill + question text +
 * an optional "select all that apply" pill for multi-select questions,
 * option rows (checkbox-style, single or multi visual radius), an optional
 * `support` slot for the why/compare/diagram tabs (Task 5 fills this in --
 * SessionView passes nothing today), and a free-text note textarea that is
 * always shown regardless of answer state. Selection state and note text are
 * owned by the caller (DecisionSection reads/writes the reader-state store)
 * so this component stays a pure, testable presentation layer. */
export function DecisionCard({
  decision,
  selectedIds,
  note,
  onPick,
  onNoteChange,
  support,
}: {
  decision: Decision
  selectedIds: string[]
  note: string
  onPick: (optionId: string) => void
  onNoteChange: (text: string) => void
  support?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-line border-l-[3px] border-l-mauve bg-card px-5 py-[18px]">
      <div className="mb-3 flex flex-wrap items-center gap-[9px]">
        <span className="rounded-md bg-mauvesoft px-[9px] py-[3px] font-mono text-[11px] font-semibold text-mauve">
          {decision.id}
        </span>
        <span className="text-[15px] font-semibold text-text">{decision.q}</span>
        {decision.multi && (
          <span className="rounded-full border border-teal px-2 py-[1px] font-mono text-[10px] text-teal">
            select all that apply
          </span>
        )}
      </div>

      {decision.opts.map((opt) => {
        const picked = selectedIds.includes(opt.id)
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onPick(opt.id)}
            aria-pressed={picked}
            className={`mb-[7px] flex w-full items-start gap-[9px] border px-3 py-[9px] text-left text-[13.5px] transition-colors max-[879px]:min-h-11 ${
              decision.multi ? 'rounded-[7px]' : 'rounded-[9px]'
            } ${picked ? 'border-mauve bg-mauvesoft text-text' : 'border-line bg-card text-sub'}`}
          >
            <span
              aria-hidden="true"
              className={`font-mono text-[13px] font-semibold ${picked ? 'text-mauve' : 'text-faint'}`}
            >
              {picked ? '[x]' : '[ ]'}
            </span>
            <span className="flex flex-col">
              <span>{opt.label}</span>
              {opt.detail && <span className="mt-0.5 text-[11.5px] text-faint">{opt.detail}</span>}
            </span>
          </button>
        )
      })}

      {support}

      <div className="mt-3">
        <div className="mb-[5px] font-mono text-[11.5px] text-faint">
          Notes / extra context (optional, every question)
        </div>
        <textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="e.g. business reason, constraints, timeline…"
          className="min-h-[52px] w-full resize-y rounded-[9px] border border-line bg-elev px-[11px] py-[9px] font-[inherit] text-[13px] text-text"
        />
      </div>
    </div>
  )
}
