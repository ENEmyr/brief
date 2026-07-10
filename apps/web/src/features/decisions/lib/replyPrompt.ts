import type { Decision } from '@brief/schema'
import type { ReaderState } from '@/features/reader-state'

/** Builds the "Generate prompt" reply text (Reader.dc.html's buildPrompt,
 * lines 354-359): one block per decision -- its id, question, the labels of
 * every selected option (resolved by id, kept in `opts` order rather than
 * selection order) or "(not answered)", and the free-text note when
 * non-empty -- closed with a fixed action line. Pure and synchronous so
 * DecisionSection can call it both for "Generate prompt" and "Rebuild from
 * answers".
 *
 * Deviation from the prototype: the prototype's opening line uses an em
 * dash ("... my decisions:" with a dash before "my"), this uses a plain
 * hyphen per the brief's literal format block -- an intentional adjudicated
 * simplification, not an oversight. */
export function buildReplyPrompt(
  decisions: Decision[],
  state: ReaderState,
  docTitle: string,
  sessionId: string,
): string {
  const lines: string[] = [`Reply to the "${docTitle}" doc (session ${sessionId}) - my decisions:`, '']

  for (const decision of decisions) {
    const selected = new Set(state.dsel[decision.id] ?? [])
    const chosenLabels = decision.opts.filter((opt) => selected.has(opt.id)).map((opt) => opt.label)
    const choice = chosenLabels.length > 0 ? chosenLabels.join('; ') : '(not answered)'

    lines.push(`[${decision.id}] ${decision.q}`)
    lines.push(`  - Choice: ${choice}`)

    const note = (state.dnote[decision.id] ?? '').trim()
    if (note) lines.push(`  - Note: ${note}`)

    lines.push('')
  }

  lines.push('Please act on the answers above; consider the extra context for any item that has a note')
  return lines.join('\n')
}
