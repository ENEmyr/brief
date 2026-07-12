'use client'
import { useRef } from 'react'
import { execCommandCopy } from '../lib/copy'
import { useDialogFocus } from '../hooks/useDialogFocus'

/**
 * Manual-copy dialog shown when the copy chain exhausts both execCommand and
 * the async Clipboard API (prototype Reader.dc.html lines 325-338's
 * copyModalView). The textarea is readOnly + autofocus + pre-selected so the
 * user can just press Ctrl+C. "Try copy again" re-runs ONLY the synchronous
 * execCommand path (prototype line 335's `if(this.execCopy(text))` --
 * prototype-fidelity fix from review: the async Clipboard API already
 * failed before this modal ever opened, so retrying it is pointless); on
 * success it fires onCopied (ExportProvider wires the "Copied" toast) and
 * closes, on failure it stays open so the user still has the selected text
 * to hand-copy. Focus trap is shared with ShareModal via useDialogFocus
 * (follows Toc.tsx's drawer pattern). Hint text uses a plain hyphen per the
 * task brief's literal wording (the prototype's own text uses an em dash in
 * the same spot -- brief wins per this repo's established
 * brief-vs-prototype tiebreaker, see cerebrum).
 */
export function CopyFallbackModal({
  text,
  onClose,
  onCopied = () => {},
}: {
  text: string
  onClose: () => void
  onCopied?: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useDialogFocus(panelRef, onClose, textareaRef)

  function handleTryAgain() {
    if (execCommandCopy(text)) {
      onCopied()
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-5 print:hidden"
      style={{ background: 'rgba(17,17,27,.55)' }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Copy manually"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="w-[min(94vw,560px)] rounded-[14px] border border-line bg-card p-[18px] shadow-[var(--shadow-card)]"
        style={{ animation: 'dc-pop .18s ease' }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[14px] font-bold">Copy manually</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="max-[879px]:min-h-11 max-[879px]:min-w-11 cursor-pointer rounded-md border-0 bg-transparent text-base text-sub"
          >
            ✕
          </button>
        </div>
        <p className="mb-2.5 text-[12.5px] text-sub">
          Auto-copy was blocked by the browser. The text is selected below - press Ctrl+C (⌘C on
          Mac).
        </p>
        <textarea
          ref={textareaRef}
          readOnly
          value={text}
          aria-label="Text to copy"
          className="min-h-[200px] w-full resize-y rounded-[10px] border border-line p-3.5 font-mono text-[12.5px] leading-[1.6]"
          style={{ background: 'var(--code-bg)', color: '#cdd6f4' }}
        />
        <div className="mt-3 flex gap-2.5">
          <button
            type="button"
            onClick={handleTryAgain}
            className="max-[879px]:min-h-11 cursor-pointer rounded-[9px] border-0 bg-mauve px-[18px] py-[9px] text-[13.5px] font-bold text-white"
          >
            ⧉ Try copy again
          </button>
          <button
            type="button"
            onClick={onClose}
            className="max-[879px]:min-h-11 cursor-pointer rounded-[9px] border border-line bg-elev px-4 py-[9px] text-[13.5px] text-text"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
