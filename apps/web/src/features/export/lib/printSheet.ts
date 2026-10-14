import type { Payload } from '@brief/schema'
import { isAnswered } from '@/features/decisions'
import type { Highlight, ReaderState } from '@/features/reader-state'

/** What one print shows that the screen does not: taken at `beforeprint`, dropped at `afterprint`. */
export interface PrintSnapshot {
  state: ReaderState
  printedAt: Date
  /** Host and path without the scheme, as B-Print writes it. */
  url: string
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}

/** "session <id> / 4 sections / 4 decisions, 3 answered" (B-Print:22). */
export function sessionLine(sessionId: string, payload: Payload, state: ReaderState): string {
  const parts = [`session ${sessionId}`, count(payload.sections.length, 'section')]
  if (payload.decisions.length > 0) {
    const answered = payload.decisions.filter((d) => isAnswered(d, state)).length
    parts.push(`${count(payload.decisions.length, 'decision')}, ${answered} answered`)
  }
  return parts.join(' / ')
}

/** "printed 2026-10-14 09:30 UTC from brief.algoryth.me/s/<id>" (B-Print:23). */
export function printedLine(printedAt: Date, url: string): string {
  const iso = printedAt.toISOString()
  return `printed ${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC from ${url}`
}

/** Paragraph and list text keep their notes inside the element, right under the text. */
const TEXT_LEAVES = new Set(['P', 'LI'])
/** Anywhere else a note follows the whole block, or the section's heading row. */
const BLOCK = 'section[data-section] > div:last-child > *, section[data-section] > div:first-child'

function noteLines(h: Highlight): [label: string, text: string][] {
  const lines: [string, string][] = []
  const note = h.note?.trim()
  if (note) lines.push(['Note:', note])
  const question = h.question?.trim()
  if (question) lines.push(['Question:', question])
  return lines
}

/**
 * Writes each highlight's note (and question, for an ask highlight) after the
 * text it belongs to, as "Note: ..." (B-Print:27), and returns the function
 * that takes them out again.
 *
 * The paragraphs belong to the reader and annotations features, so the notes
 * are added to the rendered page for the length of one print instead of being
 * rendered by them. Text only: a note is reader input and never becomes markup.
 */
export function insertPrintNotes(root: ParentNode, highlights: Highlight[]): () => void {
  for (const stale of root.querySelectorAll('[data-print-note]')) stale.remove()
  const byId = new Map(highlights.map((h) => [h.id, h]))
  const added: Element[] = []
  // Text marks carry data-mark-id (HighlightedText), code marks data-highlight-id (codeLines.ts).
  for (const mark of root.querySelectorAll<HTMLElement>('mark[data-mark-id], mark[data-highlight-id]')) {
    const highlight = byId.get(mark.dataset.markId ?? mark.dataset.highlightId ?? '')
    if (!highlight) continue
    const els = noteLines(highlight).map(([label, text]) => {
      const el = mark.ownerDocument.createElement('span')
      el.dataset.printNote = ''
      const b = mark.ownerDocument.createElement('b')
      b.textContent = label
      el.append(b, ` ${text}`)
      return el
    })
    if (els.length === 0) continue
    const leaf = mark.closest('[data-sid]')
    if (leaf && TEXT_LEAVES.has(leaf.tagName)) {
      leaf.append(...els)
    } else {
      let after = mark.closest(BLOCK) ?? leaf ?? mark
      while (after.nextElementSibling?.hasAttribute('data-print-note')) after = after.nextElementSibling
      after.after(...els)
    }
    added.push(...els)
  }
  return () => {
    for (const el of added) el.remove()
  }
}
