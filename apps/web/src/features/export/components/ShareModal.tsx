'use client'
import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogIcon, KBD, PRIMARY_BUTTON } from './Dialog'

const COPIED_FOR_MS = 1500

const CHIP = 'rounded-[3px] border border-line px-[6px] py-[2px]'

/** An expiry as the B-Overlays chip prints it: the UTC date. */
const expiryDate = (expiresAt: number) => new Date(expiresAt).toISOString().slice(0, 10)

/**
 * "Share this doc" (B-Overlays:37-45). The field shows the link without its
 * scheme, as the board does.
 */
export function ShareModal({
  sessionId,
  version,
  expiresAt,
  onClose,
  onCopy,
}: {
  sessionId: string
  version?: string
  expiresAt?: number
  onClose: () => void
  onCopy: (text: string) => Promise<'copied' | 'fallback'>
}) {
  const copyRef = useRef<HTMLButtonElement>(null)
  const [copiesShowingCopied, setCopiesShowingCopied] = useState(0)
  const url = `${window.location.origin}/s/${sessionId}`
  const shown = `${window.location.host}/s/${sessionId}`

  useEffect(() => {
    if (copiesShowingCopied === 0) return
    const timer = setTimeout(() => setCopiesShowingCopied(0), COPIED_FOR_MS)
    return () => clearTimeout(timer)
  }, [copiesShowingCopied])

  async function copy() {
    if ((await onCopy(url)) === 'copied') setCopiesShowingCopied((n) => n + 1)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    // A focused button already answers Enter with its own click.
    if (event.key !== 'Enter' || (event.target as HTMLElement).closest('button, a')) return
    event.preventDefault()
    void copy()
  }

  return (
    <Dialog
      title="Share this doc"
      icon={
        <DialogIcon>
          <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
        </DialogIcon>
      }
      initialFocusRef={copyRef}
      onClose={onClose}
      onKeyDown={handleKeyDown}
    >
      <div className="flex flex-col gap-3 px-[18px] pb-[18px] pt-4">
        <p className="m-0 text-[13px] leading-5 text-sub">Anyone with this link can open the doc via the same session id.</p>
        <div className="flex gap-2">
          <div className="flex min-h-[38px] min-w-0 grow items-center overflow-hidden rounded-ctrl border border-line2 bg-page px-[10px] font-mono text-[13px] text-text">
            <span data-share-url="" className="truncate">
              {shown}
            </span>
          </div>
          <button
            ref={copyRef}
            type="button"
            onClick={() => void copy()}
            className={`${PRIMARY_BUTTON} flex items-center gap-[6px] px-[14px]`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" />
            </svg>
            {copiesShowingCopied > 0 ? 'Copied' : 'Copy link'}
          </button>
        </div>
        <div className="flex flex-wrap gap-[6px] font-mono text-[11px] text-faint">
          <span className={CHIP}>session {sessionId}</span>
          {version && <span className={CHIP}>{version}</span>}
          {expiresAt !== undefined && <span className={CHIP}>expires {expiryDate(expiresAt)}</span>}
        </div>
        <div className="flex gap-3 border-t border-line pt-[10px] text-[12px] text-faint">
          <span>
            <kbd className={`${KBD} text-sub`}>Enter</kbd> copy
          </span>
          <span>
            <kbd className={`${KBD} text-sub`}>Esc</kbd> close
          </span>
        </div>
      </div>
    </Dialog>
  )
}
