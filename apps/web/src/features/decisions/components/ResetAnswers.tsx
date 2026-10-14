'use client'
import type { Decision } from '@brief/schema'
import { useReaderActions, useReaderState } from '@/features/reader-state'
import { isAnswered } from '../lib/answers'

const LOOK = {
  // No board draws Reset (owner ruling D5 keeps it): B-Overlays' secondary
  // "Rebuild from answers" in the dock footer, a ghost 44 in the sheet header.
  dock: 'min-h-9 self-center rounded-[4px] border border-line2 bg-transparent px-[14px] text-[13px] text-text active:scale-[.97]',
  sheet: 'min-h-11 rounded-[4px] border-0 bg-transparent px-3 text-[13px] text-sub',
}

/**
 * Clears every answer, Other answer and reason. A single-select answer cannot
 * be unpicked, so this is the only way back to unanswered. Shown once
 * anything is answered or noted.
 */
export function ResetAnswers({ decisions, variant }: { decisions: Decision[]; variant: keyof typeof LOOK }) {
  const state = useReaderState()
  const { resetDecisions } = useReaderActions()
  const touched = decisions.some((d) => isAnswered(d, state) || (state.dnote[d.id] ?? '') !== '')
  if (!touched) return null
  return (
    <button
      type="button"
      onClick={resetDecisions}
      title="Clear all answers"
      className={`${LOOK[variant]} transition-[background-color,transform] duration-[var(--dur-fast)] hover:bg-chip motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line`}
    >
      Reset
    </button>
  )
}
