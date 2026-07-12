'use client'
import type { Section } from '@brief/schema'
import { useReaderActions, useReaderState } from '@/features/reader-state'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { defaultCopyText } from '../lib/clipboard'
import { buildAskPrompt, describeLocation } from '../lib/askPrompt'

const QUOTE_MAX = 140

/** Ask popover (prototype: Reader.dc.html lines 725-739), fixed bottom-right
 * over the reader -- mauve-bordered variant of NotePopover for question
 * highlights. Copy as prompt only fires once the question is non-empty;
 * "origin" for the copied URL is read from window.location at copy time
 * rather than being a prop, replacing the prototype's hardcoded
 * shareUrl(). Non-modal: Escape and "Done" both close it, no focus trap. */
export function AskPopover({
  id,
  sections,
  sessionId,
  docTitle,
  onClose,
  onCopied = () => {},
  copyText = defaultCopyText,
}: {
  id: string
  sections: Section[]
  sessionId: string
  docTitle: string
  onClose: () => void
  onCopied?: () => void
  copyText?: (text: string) => void
}) {
  const { highlights } = useReaderState()
  const actions = useReaderActions()
  useEscapeKey(onClose)

  const h = highlights.find((x) => x.id === id)
  if (!h) return null

  const section = sections[h.sid]
  const locationRef = `${section ? section.no : ''} · ${describeLocation(h)} · ch ${h.start}–${h.end}`
  const quote = h.text.length > QUOTE_MAX ? `${h.text.slice(0, QUOTE_MAX)}…` : h.text
  const ready = !!(h.question ?? '').trim()

  function handleCopy() {
    if (!ready || !h) return
    copyText(buildAskPrompt(h, sections, sessionId, window.location.origin, docTitle))
    onCopied()
  }

  function handleRemove() {
    actions.removeHighlight(id)
    onClose()
  }

  return (
    <div
      style={{ animation: 'dc-pop .18s ease' }}
      className="fixed right-6 bottom-6 z-[82] w-[334px] rounded-xl border border-mauve bg-card p-[15px] shadow-[var(--shadow-card)]"
    >
      <div className="mb-[9px] flex flex-wrap items-center gap-[7px]">
        <span className="rounded-md bg-mauvesoft px-2 py-0.5 font-mono text-[10.5px] font-semibold text-mauve">
          ? ASK
        </span>
        <span className="font-mono text-[11px] text-faint">{locationRef}</span>
      </div>
      <div className="mb-[9px] max-h-16 overflow-auto border-l-2 border-mauve pl-2 text-xs italic text-sub">
        “{quote}”
      </div>
      <textarea
        autoFocus
        value={h.question ?? ''}
        placeholder="พิมพ์คำถามเกี่ยวกับส่วนนี้…"
        onChange={(ev) => actions.updateHighlight(id, { question: ev.target.value })}
        className="min-h-16 w-full resize-y rounded-lg border border-line bg-elev px-[10px] py-2 font-[inherit] text-[13px] text-text"
      />
      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={!ready}
          className={`max-[879px]:min-h-11 rounded-lg border-0 px-3.5 py-2 font-[inherit] text-[12.5px] font-bold text-white ${
            ready ? 'cursor-pointer bg-mauve' : 'cursor-default bg-line'
          }`}
        >
          ⧉ Copy as prompt
        </button>
        <button
          type="button"
          onClick={handleRemove}
          className="max-[879px]:min-h-11 cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 font-[inherit] text-[12.5px] text-red"
        >
          Remove
        </button>
        <button
          type="button"
          onClick={onClose}
          className="max-[879px]:min-h-11 ml-auto cursor-pointer rounded-lg border border-line bg-elev px-3 py-2 font-[inherit] text-[12.5px] text-text"
        >
          Done
        </button>
      </div>
    </div>
  )
}
