import { payloadToMarkdown } from '@brief/schema'
import type { Decision, Payload } from '@brief/schema'
import type { Highlight, ReaderState } from '@/features/reader-state'

/**
 * "## Reader highlights & notes" section (prototype Reader.dc.html lines
 * 275-279), adapted with a "- Reader question:" subline for ask highlights
 * alongside the prototype's "- Reader note:" one -- the real schema's
 * Highlight can carry both a note and a question independently.
 */
function highlightsSection(highlights: Highlight[]): string {
  const lines = ['## Reader highlights & notes', '']
  if (highlights.length === 0) {
    lines.push('_(no highlights)_')
    return lines.join('\n')
  }
  highlights.forEach((h, i) => {
    lines.push(`${i + 1}. Highlighted: “${h.text}”`)
    if (h.note) lines.push(`   - Reader note: ${h.note}`)
    if (h.question) lines.push(`   - Reader question: ${h.question}`)
  })
  return lines.join('\n')
}

/**
 * "## Decisions" section (prototype lines 280-288's decisionSection loop),
 * resolved against the reader's actual answers rather than the blank
 * checkboxes payloadToMarkdown's own "## Decisions" section renders --
 * intentionally a second "## Decisions" heading in the final document (the
 * first is the raw/unaware question list from payloadToMarkdown, this one
 * is the reader's answer summary), per the task-p4-6 brief.
 */
function decisionsSection(decisions: Decision[], state: ReaderState): string {
  const lines = ['## Decisions', '']
  for (const d of decisions) {
    const selected = state.dsel[d.id] ?? []
    lines.push(`### [${d.id}] ${d.q}${d.multi ? ' _(multi-select)_' : ''}`)
    lines.push('')
    lines.push('Options:')
    for (const o of d.opts) {
      lines.push(`- [${selected.includes(o.id) ? 'x' : ' '}] ${o.label}`)
    }
    lines.push('')
    const answerLabels = d.opts.filter((o) => selected.includes(o.id)).map((o) => o.label)
    lines.push(`- **Answer:** ${answerLabels.length ? answerLabels.join('; ') : '_(not answered)_'}`)
    const note = (state.dnote[d.id] ?? '').trim()
    lines.push(`- **Free-text note:** ${note || '_(none)_'}`)
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}

/**
 * Builds the full export markdown: the complete machine-readable document
 * (packages/schema's payloadToMarkdown) plus the reader's own highlights and
 * decision answers appended, matching the prototype's buildMarkdown (lines
 * 247-291) adapted to this repo's real Payload/ReaderState shapes. Exported
 * separately (pure, no DOM/Blob access) so tests can assert on the string
 * without touching the browser download APIs.
 */
export function buildExportMarkdown(
  payload: Payload,
  state: ReaderState,
  sessionId: string,
  origin: string,
): string {
  const url = `${origin}/s/${sessionId}`
  const parts = [payloadToMarkdown(payload, { url }).trimEnd(), highlightsSection(state.highlights)]
  // A payload with no decisions gets no appended "## Decisions" section at
  // all (payloadToMarkdown skips its own too) -- a dangling heading with no
  // content under it would just be noise for the reading agent.
  if (payload.decisions.length > 0) parts.push(decisionsSection(payload.decisions, state))
  parts.push(`_Exported from Brief · ${url}_`)
  return parts.join('\n\n') + '\n'
}

/**
 * Triggers a browser download of the export markdown as
 * brief-<sessionId>.md (prototype's saveMd, lines 292-298), via an
 * off-screen anchor + object URL. Revocation is deferred by 500ms (matching
 * the prototype exactly) rather than happening synchronously right after
 * `.click()` -- some browsers can still be resolving the download when the
 * click handler returns, so revoking the object URL immediately risks
 * racing it; the prototype author's own 500ms delay is evidence this was a
 * deliberate choice, not an oversight worth "simplifying" away.
 */
export function downloadMarkdown(
  payload: Payload,
  state: ReaderState,
  sessionId: string,
  origin: string,
): void {
  const markdown = buildExportMarkdown(payload, state, sessionId, origin)
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `brief-${sessionId}.md`
  document.body.appendChild(anchor)
  anchor.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
    anchor.remove()
  }, 500)
}
