import type { StoredPayload } from '@brief/schema'
import { isAnswered } from '@/features/decisions'
import type { Highlight, ReaderState } from '@/features/reader-state'

export interface PrintSnapshot {
  state: ReaderState
  printedAt: Date
  hostPath: string
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}

export function sessionLine(sessionId: string, payload: StoredPayload, state: ReaderState): string {
  const parts = [`session ${sessionId}`, count(payload.sections.length, 'section')]
  if (payload.decisions.length > 0) {
    const answered = payload.decisions.filter((d) => isAnswered(d, state)).length
    parts.push(`${count(payload.decisions.length, 'decision')}, ${answered} answered`)
  }
  return parts.join(' / ')
}

export function printedLine(printedAt: Date, hostPath: string): string {
  const iso = printedAt.toISOString()
  return `printed ${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC from ${hostPath}`
}

const TEXT_LEAVES = new Set(['P', 'LI'])
const BLOCK = 'section[data-section] > div:last-child > *, section[data-section] > div:first-child'

function noteLines(h: Highlight): [label: string, text: string][] {
  const lines: [string, string][] = []
  const note = h.note?.trim()
  if (note) lines.push(['Note:', note])
  const question = h.question?.trim()
  if (question) lines.push(['Question:', question])
  return lines
}

export function insertPrintNotes(root: ParentNode, highlights: Highlight[]): () => void {
  for (const stale of root.querySelectorAll('[data-print-note]')) stale.remove()
  const byId = new Map(highlights.map((h) => [h.id, h]))
  const added: Element[] = []
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
