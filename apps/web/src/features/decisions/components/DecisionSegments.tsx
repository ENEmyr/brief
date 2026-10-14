'use client'
import type { Decision } from '@brief/schema'
import type { ReaderState } from '@/features/reader-state'
import { isAnswered } from '../lib/answers'

/** One segment per decision: answered accent, the first open one warn, the rest line. */
export function DecisionSegments({ decisions, state }: { decisions: Decision[]; state: ReaderState }) {
  const firstOpen = decisions.findIndex((d) => !isAnswered(d, state))
  return (
    <div className="flex gap-[3px]" aria-hidden="true">
      {decisions.map((d, i) => {
        let tone = 'bg-line'
        if (isAnswered(d, state)) tone = 'bg-accent'
        else if (i === firstOpen) tone = 'bg-[var(--c-warn-fill)]'
        return <span key={d.id} className={`h-1 flex-1 rounded-[2px] ${tone}`} />
      })}
    </div>
  )
}
