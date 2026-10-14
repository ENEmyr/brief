'use client'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { Decision } from '@brief/schema'
import { useDialogFocus } from '@/features/export'
import { useReaderState, useReaderStateStore } from '@/features/reader-state'
import { modKeyLabel } from '@/features/shortcuts'
import { decisionCounts, isAnswered } from '../lib/answers'
import { buildReplyPrompt } from '../lib/replyPrompt'

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line'
const CHIP = 'rounded-[3px] px-[6px] py-[2px]'
const BUTTON = `min-h-9 rounded-[4px] px-[14px] text-[13px] transition-transform duration-[var(--dur-fast)] active:scale-[.97] motion-reduce:transition-none max-[880px]:min-h-11 ${FOCUS_RING}`

/**
 * "Review prompt before copying" as B-Overlays' right sheet (lines 118-139):
 * 500 wide, opens at any time (D5), so open questions print "(not answered)"
 * and a chip row counts answered, open and notes with "Go to Dn" for the
 * first open one. The text is editable and keeps edits until "Rebuild from
 * answers". Copy prompt, or Cmd/Ctrl Enter anywhere in the sheet, copies it.
 * The copy-back prompt never prints (B-Print).
 */
export function PromptReviewSheet({
  decisions,
  docTitle,
  sessionId,
  copyText,
  onClose,
  onGoTo,
}: {
  decisions: Decision[]
  docTitle: string
  sessionId: string
  copyText: (text: string) => void
  onClose: () => void
  onGoTo: (decisionId: string) => void
}) {
  const state = useReaderState()
  const store = useReaderStateStore()
  const build = useCallback(
    () => buildReplyPrompt(decisions, store.getState(), docTitle, sessionId),
    [decisions, store, docTitle, sessionId],
  )
  const [text, setText] = useState(build)
  const panelRef = useRef<HTMLElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const titleId = useId()
  const { answered, open, notes } = decisionCounts(decisions, state)
  const firstOpen = decisions.find((d) => !isAnswered(d, state))
  const mod = modKeyLabel()

  // useDialogFocus re-runs on every new onClose identity, which would bounce
  // focus to the trigger and back each time the shell re-renders.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  const stableClose = useCallback(() => onCloseRef.current(), [])
  useDialogFocus(panelRef, stableClose, textRef)
  // The focus hook selects a textarea it focuses; here a stray key would replace the whole prompt.
  useEffect(() => {
    textRef.current?.setSelectionRange(0, 0)
  }, [])

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      copyText(text)
    }
  }

  return (
    <div className="console-fade fixed inset-0 z-[95] bg-[var(--c-scrim)] print:hidden" onClick={onClose}>
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        // 500 plus the 1px left border, as B-Overlays renders its content-box sheet.
        className="console-sheet-right fixed inset-y-0 right-0 flex w-[501px] max-w-full flex-col border-l border-line2 bg-card leading-[normal] shadow-[var(--shadow-sheet)] outline-none"
      >
        <div className="flex items-start gap-[10px] border-b border-line py-3 pl-[18px] pr-[10px]">
          <span className="flex grow flex-col gap-[2px]">
            <span id={titleId} className="text-[15px] font-semibold">
              Review prompt before copying
            </span>
            <span className="text-[12px] text-sub">Edit freely. This text goes back to the agent.</span>
          </span>
          <button
            type="button"
            aria-label="Close prompt review"
            onClick={onClose}
            className={`flex size-8 shrink-0 items-center justify-center rounded-[4px] border-0 bg-transparent text-sub transition-[background-color,transform] duration-[var(--dur-fast)] hover:bg-chip active:scale-[.97] motion-reduce:transition-none max-[880px]:size-11 ${FOCUS_RING}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-[6px] border-b border-line px-[18px] py-[10px] font-mono text-[11px]">
          <span className={`${CHIP} bg-good-soft text-good`}>{answered} answered</span>
          {open > 0 && <span className={`${CHIP} bg-warn-soft text-warn`}>{open} open</span>}
          <span className={`${CHIP} border border-line text-sub`}>
            {notes} {notes === 1 ? 'note' : 'notes'}
          </span>
          <span className="grow" />
          {firstOpen && (
            <button
              type="button"
              onClick={() => onGoTo(firstOpen.id)}
              className={`border-0 bg-transparent p-0 font-sans text-[12px] text-accent-text underline max-[880px]:min-h-11 ${FOCUS_RING}`}
            >
              Go to {firstOpen.id}
            </button>
          )}
        </div>
        <textarea
          ref={textRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-label="Prompt text"
          className={`mx-[18px] mt-3 min-h-0 grow resize-none rounded-[4px] border border-line2 bg-[var(--c-code-bg)] px-[14px] py-3 font-mono text-[12.5px] leading-5 text-text outline-none ${FOCUS_RING}`}
        />
        <div className="flex items-center gap-2 px-[18px] pb-4 pt-3">
          <button
            type="button"
            onClick={() => copyText(text)}
            className={`flex items-center gap-2 border-0 bg-accent font-semibold text-on-accent ${BUTTON}`}
          >
            Copy prompt
            <kbd className="rounded-[3px] border border-[color-mix(in_srgb,var(--c-on-accent)_35%,transparent)] px-1 font-mono text-[10px]">
              {mod} Enter
            </kbd>
          </button>
          <button
            type="button"
            onClick={() => setText(build())}
            className={`border border-line2 bg-transparent text-text hover:bg-chip ${BUTTON}`}
          >
            Rebuild from answers
          </button>
          <span className="grow" />
          <span className="font-mono text-[11px] text-faint">{text.length} chars</span>
        </div>
      </aside>
    </div>
  )
}
