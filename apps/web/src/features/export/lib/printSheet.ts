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

/**
 * Writes each highlight note after the text it belongs to, as "Note: ..."
 * (B-Print:27), and returns the function that takes them out again.
 *
 * The paragraphs belong to the reader and annotations features, so the notes
 * are added to the rendered page for the length of one print instead of being
 * rendered by them. A note goes at the end of the highlighted leaf (the
 * paragraph, cell or item), or after the code listing for a highlight in code.
 * Text only: a note is reader input and never becomes markup.
 */
export function insertPrintNotes(root: ParentNode, highlights: Highlight[]): () => void {
  for (const stale of root.querySelectorAll('[data-print-note]')) stale.remove()
  const added: Element[] = []
  for (const mark of root.querySelectorAll<HTMLElement>('mark[data-mark-id]')) {
    const note = highlights.find((h) => h.id === mark.dataset.markId)?.note?.trim()
    if (!note) continue
    const leaf = mark.closest('[data-sid]') ?? mark.parentElement
    if (!leaf) continue
    const el = mark.ownerDocument.createElement('span')
    el.dataset.printNote = ''
    const label = mark.ownerDocument.createElement('b')
    label.textContent = 'Note:'
    el.append(label, ` ${note}`)
    const pre = leaf.closest('pre')
    if (pre) pre.after(el)
    else leaf.append(el)
    added.push(el)
  }
  return () => {
    for (const el of added) el.remove()
  }
}
