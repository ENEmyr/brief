'use client'
import type { Section } from '@brief/schema'
import { useReaderActions, useReaderState } from '@/features/reader-state'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { defaultCopyText } from '../lib/clipboard'
import { buildAskPrompt, describeLocation } from '../lib/askPrompt'

const QUOTE_MAX = 140

/** Ask popover (prototype: Reader.dc.html lines 725-739), fixed bottom-right
 * over the reader -- accent-bordered variant of NotePopover for question
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
      data-popover=""
      className="console-pop fixed right-6 bottom-6 z-[82] w-[334px] rounded-overlay border border-accent-line bg-card p-[15px] shadow-[var(--shadow-overlay)]"
    >
      <div className="mb-[9px] flex flex-wrap items-center gap-[7px]">
        <span className="rounded-[3px] bg-accent-soft px-[6px] py-[2px] font-mono text-[11px] font-semibold text-accent-text">
          ? ASK
        </span>
        <span className="font-mono text-[11px] text-faint">{locationRef}</span>
      </div>
      <div className="mb-[9px] max-h-16 overflow-auto border-l-2 border-accent-line pl-2 text-xs italic text-sub">
        “{quote}”
      </div>
      <textarea
        autoFocus
        value={h.question ?? ''}
        placeholder="Type a question about this part…"
        onChange={(ev) => actions.updateHighlight(id, { question: ev.target.value })}
        className="min-h-16 w-full resize-y rounded-ctrl border border-line2 bg-page px-[10px] py-2 font-[inherit] text-[16px] leading-6 text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line"
      />
      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={!ready}
          className="max-[880px]:min-h-11 inline-flex min-h-8 cursor-pointer items-center gap-[6px] rounded-ctrl border-0 bg-accent px-3.5 font-[inherit] text-[13px] font-semibold text-on-accent transition-transform duration-[var(--dur-fast)] active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
          Copy as prompt
        </button>
        <button
          type="button"
          onClick={handleRemove}
          className="max-[880px]:min-h-11 min-h-8 cursor-pointer rounded-ctrl border-0 bg-transparent px-2 font-[inherit] text-[13px] text-bad focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line"
        >
          Remove
        </button>
        <button
          type="button"
          onClick={onClose}
          className="max-[880px]:min-h-11 ml-auto min-h-8 cursor-pointer rounded-ctrl border border-line2 bg-transparent px-3 font-[inherit] text-[13px] text-text transition-transform duration-[var(--dur-fast)] active:scale-[.97] motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line"
        >
          Done
        </button>
      </div>
    </div>
  )
}
