'use client'
import { useEffect, useRef } from 'react'
import { usePanZoom } from '../hooks/usePanZoom'
import { PanZoomSurface, ZoomControls } from './PanZoomSurface'

export interface ViewerOverlayProps {
  content: React.ReactNode | null
  onClose: () => void
}

const TOOLBAR_BUTTON_CLASS =
  'flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-white px-3 text-[15px] leading-none text-[#11111b] transition-colors hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mauve'

/**
 * Fullscreen zoom/pan viewer for expanded diagrams.
 *
 * `content` is a live React node owned by the block that expanded it (see
 * useViewer), not an HTML string, so there is no dangerouslySetInnerHTML sink
 * here and nothing to sanitize: the node is rendered by React like any other
 * child. The block's own markup was already sanitized where it was produced
 * (MermaidBlock runs its generated SVG through DOMPurify before rendering it).
 */
export function ViewerOverlay({ content, onClose }: ViewerOverlayProps) {
  const isOpen = content !== null

  const pan = usePanZoom('overlay', isOpen)
  const { reset } = pan

  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Dialog a11y + lifecycle: on open, remember whatever had focus so it can be
  // restored on close, move focus into the dialog, and wire Escape plus simple
  // Tab containment (same pattern as the TOC drawer). The cleanup only runs
  // after an open, so it doubles as the close step: restore focus and drop any
  // transform, so a stale zoom can never survive into the next open.
  useEffect(() => {
    if (!isOpen) return

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (!first || !last) return

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocusedRef.current?.focus()
      reset()
    }
    // Keyed on isOpen only, so it does not re-run (and re-steal focus) on every
    // parent re-render while open.
  }, [isOpen, reset])

  if (!isOpen) return null

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Diagram viewer"
      tabIndex={-1}
      className="fixed inset-0 z-[100] outline-none print:hidden"
      style={{ background: 'rgba(17,17,27,.93)' }}
    >
      <div data-zbar="1" className="absolute right-[18px] top-4 z-[2] flex gap-1.5">
        <ZoomControls api={pan} className="flex gap-1.5" buttonClassName={TOOLBAR_BUTTON_CLASS} />
        <button
          type="button"
          aria-label="Close viewer"
          onClick={onClose}
          className={TOOLBAR_BUTTON_CLASS}
        >
          ✕ Close
        </button>
      </div>

      <PanZoomSurface
        api={pan}
        className="flex h-full items-center justify-center"
        contentClassName="w-[min(80vw,900px)] rounded-[10px] border border-transparent bg-card p-6 shadow-[var(--shadow-card)] [[data-theme=mocha]_&]:border-line"
      >
        {content}
      </PanZoomSurface>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-black/40 px-3 py-1 text-[12px] text-slate-200">
        Drag to pan · scroll to zoom · Fit to scale it to the screen
      </div>
    </div>
  )
}
