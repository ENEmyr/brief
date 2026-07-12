'use client'
import { useCallback, useRef, useState } from 'react'
import { useDialogFocus } from '@/features/export'
import { FOCUS_RING, GHOST_BUTTON } from './topbarChrome'

const MENU_ITEM =
  `flex w-full min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[12.5px] font-medium text-text transition-colors hover:bg-chip active:bg-mauvesoft ${FOCUS_RING}`

/**
 * The open menu, split out because useDialogFocus must not run while the menu
 * is closed: the hook grabs focus and registers on the shared dialog stack on
 * mount, so mounting it only when open is what makes "Escape closes the menu
 * and focus returns to the trigger" fall out for free, with the same stacking
 * rules as ShareModal/CopyFallbackModal (a menu open under a modal must not
 * swallow that modal's Escape).
 */
function DownloadMenuPanel({
  onDownload,
  onPrint,
  onClose,
}: {
  onDownload?: () => void
  onPrint?: () => void
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const firstItemRef = useRef<HTMLButtonElement>(null)

  useDialogFocus(panelRef, onClose, firstItemRef)

  // Every item closes the menu after acting: print hands off to the browser's
  // print dialog, and a menu left hanging open would be captured in the PDF.
  const run = (action?: () => void) => () => {
    onClose()
    action?.()
  }

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label="Download"
      tabIndex={-1}
      className="absolute right-0 top-[calc(100%+6px)] z-50 w-[190px] rounded-xl border border-line bg-card p-1.5 shadow-[var(--shadow-card)] outline-none"
      style={{ animation: 'dc-pop .18s ease' }}
    >
      {onDownload && (
        <button
          ref={firstItemRef}
          type="button"
          role="menuitem"
          onClick={run(onDownload)}
          className={MENU_ITEM}
        >
          <span aria-hidden="true" className="text-[13px] text-mauve">
            ↓
          </span>
          Markdown (.md)
        </button>
      )}
      {onPrint && (
        <button
          // Focus lands here when markdown is absent, so the ref follows the
          // first item that actually renders rather than a fixed one.
          ref={onDownload ? undefined : firstItemRef}
          type="button"
          role="menuitem"
          onClick={run(onPrint)}
          className={MENU_ITEM}
        >
          <span aria-hidden="true" className="text-[13px] text-mauve">
            ⎙
          </span>
          Print / PDF
        </button>
      )}
    </div>
  )
}

/**
 * One Download control in place of the two separate Markdown and Print / PDF
 * buttons. Both are the same reader intent ("give me this doc as a file"), and
 * collapsing them frees a slot in a topbar that is already tight at the
 * 880px breakpoint where every label hides.
 */
export function DownloadMenu({
  onDownload,
  onPrint,
}: {
  onDownload?: () => void
  onPrint?: () => void
}) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  if (!onDownload && !onPrint) return null

  return (
    <div className="relative">
      {/* Click-away layer: covers the viewport behind the menu so a click
          anywhere else dismisses it, without a document-level listener that
          would race the trigger's own onClick. */}
      {open && <div className="fixed inset-0 z-40" onClick={close} />}
      <button
        type="button"
        onClick={(event) => {
          // Focus the trigger before the menu mounts: useDialogFocus restores
          // focus to whatever was active when it opened, and a click does not
          // reliably focus a button (Safari does not, and neither does jsdom).
          // Without this, closing the menu would drop focus on <body>.
          event.currentTarget.focus()
          setOpen((prev) => !prev)
        }}
        aria-label="Download"
        aria-haspopup="menu"
        aria-expanded={open}
        className={GHOST_BUTTON}
      >
        <span aria-hidden="true" className="text-[13px] text-mauve">
          ↓
        </span>
        <span className="hidden min-[880px]:inline">Download</span>
      </button>
      {open && <DownloadMenuPanel onDownload={onDownload} onPrint={onPrint} onClose={close} />}
    </div>
  )
}
