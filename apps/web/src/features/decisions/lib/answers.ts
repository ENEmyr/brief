import type { Decision } from '@brief/schema'
import type { ReaderState } from '@/features/reader-state'

type Answers = Pick<ReaderState, 'dsel' | 'dother'>

export function otherPicked(decisionId: string, state: Pick<ReaderState, 'dother'>): boolean {
  return Object.hasOwn(state.dother, decisionId)
}

/** "Other: <text>" when the reader picked Other (text may still be empty), else undefined. */
export function otherLabel(
  decision: Decision,
  state: Pick<ReaderState, 'dother'>,
): string | undefined {
  if (!otherPicked(decision.id, state)) return undefined
  return `Other: ${(state.dother[decision.id] ?? '').trim()}`.trimEnd()
}

/** Every answer a prompt prints for a decision: the agent's options in `opts` order, then Other. */
export function answerLabels(decision: Decision, state: Answers): string[] {
  const selected = new Set(state.dsel[decision.id] ?? [])
  const labels = decision.opts.filter((opt) => selected.has(opt.id)).map((opt) => opt.label)
  const other = otherLabel(decision, state)
  return other === undefined ? labels : [...labels, other]
}

/** Answered means the prompt prints an answer for it, so an unknown stored option id does not count. */
export function isAnswered(decision: Decision, state: Answers): boolean {
  return answerLabels(decision, state).length > 0
}

export interface DecisionCounts {
  answered: number
  open: number
  /** Decisions with a reason: the `Note:` lines the prompt prints. */
  notes: number
}

export function decisionCounts(
  decisions: Decision[],
  state: Pick<ReaderState, 'dsel' | 'dother' | 'dnote'>,
): DecisionCounts {
  const answered = decisions.filter((d) => isAnswered(d, state)).length
  const notes = decisions.filter((d) => (state.dnote[d.id] ?? '').trim() !== '').length
  return { answered, open: decisions.length - answered, notes }
}

/** The first unanswered decision after `fromId` (wrapping, never `fromId` itself), or from the top without one. */
export function nextOpenDecision(
  decisions: Decision[],
  state: Answers,
  fromId?: string,
): Decision | undefined {
  const start = fromId === undefined ? -1 : decisions.findIndex((d) => d.id === fromId)
  for (let step = 1; step <= decisions.length; step++) {
    const decision = decisions[(start + step) % decisions.length]!
    if (decision.id !== fromId && !isAnswered(decision, state)) return decision
  }
  return undefined
}
