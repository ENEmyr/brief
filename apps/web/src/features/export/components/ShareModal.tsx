'use client'
import { useRef } from 'react'
import { useDialogFocus } from '../hooks/useDialogFocus'

/**
 * Share-link dialog (prototype Reader.dc.html lines 418-435). `onCopy`
 * receives the built share URL -- ExportProvider wires it to the copy chain
 * (toast on success, CopyFallbackModal on failure) so this component stays
 * a plain presentational dialog, same posture as NotePopover/AskPopover
 * taking a `copyText` callback rather than reaching into a copy singleton
 * itself. Focus trap / restore is shared with CopyFallbackModal via
 * useDialogFocus (follows Toc.tsx's drawer pattern).
 */
export function ShareModal({
  sessionId,
  version,
  onClose,
  onCopy,
}: {
  sessionId: string
  version?: string
  onClose: () => void
  onCopy: (text: string) => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const url = `${window.location.origin}/s/${sessionId}`

  useDialogFocus(panelRef, onClose)

  return (
    <div
      className="fixed inset-0 z-[95] flex justify-center bg-black/50 px-5 print:hidden"
      style={{ paddingTop: '14vh' }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Share this doc"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="h-fit w-[min(92vw,440px)] rounded-[14px] border border-line bg-card p-5 shadow-[var(--shadow-card)]"
        style={{ animation: 'dc-pop .18s ease' }}
      >
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[15px] font-bold">⇗ Share this doc</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="max-[879px]:min-h-11 max-[879px]:min-w-11 cursor-pointer rounded-md border-0 bg-transparent text-base text-sub"
          >
            ✕
          </button>
        </div>
        <p className="mb-3.5 text-[13px] text-sub">
          Anyone with this link can open the doc via the same session id
        </p>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 overflow-hidden rounded-[9px] border border-line bg-elev px-3 py-[9px] font-mono text-[12.5px] text-text">
            <span className="text-mauve">⎇</span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{url}</span>
          </div>
          <button
            type="button"
            onClick={() => onCopy(url)}
            className="max-[879px]:min-h-11 cursor-pointer whitespace-nowrap rounded-[9px] border-0 bg-mauve px-4 py-[9px] text-[13px] font-semibold text-white"
          >
            Copy
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <span className="rounded-md bg-chip px-2.5 py-[3px] font-mono text-[11px] text-faint">
            session {sessionId}
          </span>
          {version && (
            <span className="rounded-md bg-chip px-2.5 py-[3px] font-mono text-[11px] text-faint">
              {version}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
