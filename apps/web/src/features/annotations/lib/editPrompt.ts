import type { Payload } from '@brief/schema'
import { decisionAnswerLines } from '@/features/decisions'
import type { ReaderState } from '@/features/reader-state'
import { API_URL } from '@/shared/api'
import { describeLocation, pad } from './askPrompt'

/**
 * Builds the "Copy edit prompt" text for the Edit menu's live action: every
 * highlight with its anchor (reusing describeLocation/pad from askPrompt.ts
 * so locations read identically everywhere), every decision answer (reusing
 * decisionAnswerLines from the decisions feature), a pointer to the current
 * document content, and a closing instruction to publish the result as a
 * new Brief rather than mutate this session.
 *
 * The receiving AI cannot act on edit points alone -- it also needs the
 * document those points refer to. For a plain session that is the /raw
 * markdown endpoint; an encrypted session's server holds only ciphertext
 * (the raw endpoint 403s and reader state is never persisted for it), so
 * the prompt tells the human to paste the document instead of pointing the
 * AI at a URL that would return nothing usable.
 *
 * Returns null when there is nothing to act on (no highlights, no decision
 * ever selected or noted) -- a prompt telling an AI to "update the document"
 * with zero requested changes would just be noise, so the caller is expected
 * to refuse to copy anything and say so instead.
 */
export function buildEditPrompt(
  payload: Payload,
  state: ReaderState,
  sessionId: string,
  origin: string,
  encrypted: boolean,
): string | null {
  const hasHighlights = state.highlights.length > 0
  const hasDecisionInput = payload.decisions.some(
    (d) => (state.dsel[d.id] ?? []).length > 0 || (state.dnote[d.id] ?? '').trim() !== '',
  )
  if (!hasHighlights && !hasDecisionInput) return null

  const url = `${origin}/s/${sessionId}`
  const lines: string[] = [
    `Update the "${payload.meta.title}" doc (session ${sessionId}) using my edit points below.`,
    `Reference: ${url}`,
    '',
  ]

  if (encrypted) {
    lines.push(
      'Source: this session is encrypted, so the server only holds ciphertext and cannot be fetched.',
      'Paste the current document content below this line before sending this prompt.',
      '',
    )
  } else {
    lines.push(
      `Source: ${API_URL}/api/session/${sessionId}/raw (the current document as markdown)`,
      '',
    )
  }

  lines.push('Edit points:', '')
  if (!hasHighlights) {
    lines.push('(no highlights)', '')
  } else {
    state.highlights.forEach((h, i) => {
      const section = payload.sections[h.sid]
      const locationSection = section ? `section ${pad(section.no)} "${section.title}"` : `section ${h.sid}`
      lines.push(`${i + 1}. ${locationSection} - ${describeLocation(h)} - chars ${h.start}-${h.end}`)
      lines.push(`   Quoted: "${h.text}"`)

      const note = (h.note ?? '').trim()
      const question = (h.question ?? '').trim()
      if (note) lines.push(`   Edit request: ${note}`)
      if (question) lines.push(`   Reader question: ${question}`)
      if (!note && !question) lines.push('   (highlighted only, no note or question - use judgment)')

      lines.push('')
    })
  }

  if (payload.decisions.length > 0) {
    lines.push('Decisions:', '', ...decisionAnswerLines(payload.decisions, state))
  }

  lines.push(
    'Produce an updated payload that reflects the edit points and decisions above, and publish',
    'it as a new Brief. Do not try to modify this session in place; the original link stays valid.',
  )

  return lines.join('\n')
}
