'use client'
import { useRef } from 'react'
import { execCommandCopy } from '../lib/copy'
import { Dialog, DialogActions, KBD, PRIMARY_BUTTON, SECONDARY_BUTTON } from './Dialog'

/** "Copy manually" (B-Overlays:97-109). */
export function CopyFallbackModal({
  text,
  onClose,
  onCopied = () => {},
}: {
  text: string
  onClose: () => void
  onCopied?: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function retryExecCommandCopy() {
    if (execCommandCopy(text)) {
      onCopied()
      onClose()
    }
  }

  return (
    <Dialog title="Copy manually" layer="fallback" initialFocusRef={textareaRef} onClose={onClose}>
      <div className="flex flex-col gap-[10px] px-[18px] pb-4 pt-[14px]">
        <p className="m-0 text-[13px] leading-5 text-sub">
          The browser blocked the clipboard. The text is already selected, press <kbd className={KBD}>Ctrl C</kbd> or{' '}
          <kbd className={KBD}>⌘ C</kbd>.
        </p>
        <textarea
          ref={textareaRef}
          readOnly
          value={text}
          aria-label="Text to copy"
          className="h-[172px] w-full resize-none rounded-ctrl border border-line2 bg-[var(--c-code-bg)] px-3 py-[10px] font-mono text-[12px] leading-[18px] text-text selection:bg-[var(--c-selection)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line"
        />
        <DialogActions>
          <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
            Close
          </button>
          <button type="button" onClick={retryExecCommandCopy} className={`${PRIMARY_BUTTON} px-4`}>
            Try copy again
          </button>
        </DialogActions>
      </div>
    </Dialog>
  )
}
