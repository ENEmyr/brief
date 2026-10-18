'use client'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { usePanZoom } from '../hooks/usePanZoom'
import type { ViewerHeading, ViewerSteps } from '../hooks/useViewer'
import { PanZoomSurface } from './PanZoomSurface'

export interface ViewerOverlayProps {
  content: React.ReactNode | null
  heading?: ViewerHeading
  steps?: ViewerSteps
  onClose: () => void
}

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line'

/** B-Overlays:149-150: 36px buttons inside a bordered group; 44 under 880 (settled touch rule). */
const GROUP_BUTTON_BASE = `flex items-center justify-center rounded-[3px] bg-elev text-text transition-[background-color,transform] duration-[var(--dur-fast)] enabled:hover:bg-chip enabled:active:scale-[.97] disabled:opacity-45 motion-reduce:transition-none ${FOCUS_RING}`
const GROUP_BUTTON = `${GROUP_BUTTON_BASE} size-9 max-[880px]:size-11`

const GROUP = 'flex items-center gap-0.5 rounded-[4px] border border-line p-0.5'

const KBD = 'rounded-[3px] border border-line2 px-1 font-mono text-[10px]'

/**
 * Fullscreen viewer for an expanded diagram (B-Overlays:146-170, features.md
 * B5). Every gesture has a button: zoom out, zoom level, zoom in, Fit, the
 * previous and next step when the diagram has steps, and Close (Esc).
 *
 * `content` is a live React node owned by the block that expanded it (see
 * useViewer), not an HTML string, so there is no dangerouslySetInnerHTML sink
 * here: the block's own markup was sanitized where it was produced.
 */
export function ViewerOverlay({ content, heading, steps, onClose }: ViewerOverlayProps) {
  const isOpen = content !== null

  const pan = usePanZoom(isOpen)
  const { reset, fit, zoomIn, zoomOut } = pan

  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const latest = useRef({ onClose, steps, zoomIn, zoomOut, fit })
  useEffect(() => {
    latest.current = { onClose, steps, zoomIn, zoomOut, fit }
  })

  // A diagram wider or taller than the screen opens scaled down to fit; a
  // small one opens at 100%, never blown up.
  useLayoutEffect(() => {
    if (!isOpen) return
    const surface = pan.surfaceRef.current
    const box = pan.contentRef.current
    if (!surface || !box) return
    if (box.offsetWidth > surface.clientWidth || box.offsetHeight > surface.clientHeight) fit()
    // Measured once per open; a later zoom is the reader's.
  }, [isOpen])

  // Dialog a11y + lifecycle: on open, remember whatever had focus so it can be
  // restored on close, move focus into the dialog, and wire the keys plus simple
  // Tab containment. The cleanup only runs after an open, so it doubles as the
  // close step: restore focus and drop any transform or half-finished gesture,
  // so nothing survives into the next open (bug-121).
  useEffect(() => {
    if (!isOpen) return

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      const { onClose: close, steps: currentSteps, zoomIn: zin, zoomOut: zout, fit: fitNow } = latest.current
      if (event.key === 'Escape') {
        close()
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const action: Record<string, (() => void) | undefined> = {
        ArrowLeft: currentSteps?.onPrev,
        ArrowRight: currentSteps?.onNext,
        '+': zin,
        '=': zin,
        '-': zout,
        '0': fitNow,
      }
      const run = action[event.key]
      if (run) {
        event.preventDefault()
        run()
        return
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (!first || !last) return

        // Focus starts on the dialog itself, which is in neither end of the list.
        const outside = !dialogRef.current.contains(document.activeElement) || document.activeElement === dialogRef.current
        if (event.shiftKey && (outside || document.activeElement === first)) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && (outside || document.activeElement === last)) {
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

  const stepGroup = steps ? (
    <div role="group" aria-label="Steps" className={GROUP}>
      <button
        type="button"
        aria-label="Previous step"
        disabled={!steps.onPrev}
        onClick={steps.onPrev}
        className={GROUP_BUTTON}
      >
        ‹
      </button>
      <span className="min-w-14 text-center font-mono text-[12px] text-sub">{steps.label}</span>
      <button
        type="button"
        aria-label="Next step"
        disabled={!steps.onNext}
        onClick={steps.onNext}
        className={GROUP_BUTTON}
      >
        ›
      </button>
    </div>
  ) : null

  const zoomGroup = (
    <div role="group" aria-label="Zoom" className={GROUP}>
      <button type="button" aria-label="Zoom out" onClick={pan.zoomOut} className={`${GROUP_BUTTON} text-[16px]`}>
        −
      </button>
      <span className="min-w-[52px] text-center font-mono text-[12px] text-sub">{Math.round(pan.zoom * 100)}%</span>
      <button type="button" aria-label="Zoom in" onClick={pan.zoomIn} className={`${GROUP_BUTTON} text-[16px]`}>
        +
      </button>
      <button
        type="button"
        onClick={pan.fit}
        className={`${GROUP_BUTTON_BASE} h-9 px-2.5 text-[12px] max-[880px]:h-11`}
      >
        Fit
      </button>
    </div>
  )

  // One grid, so the step and zoom groups exist once: in the top bar on wide
  // screens, in a bottom bar under 880 with the step text above it
  // (B-Overlays:171).
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Diagram viewer"
      tabIndex={-1}
      className="fixed inset-0 z-[100] grid grid-cols-[auto_minmax(0,1fr)_auto_auto] grid-rows-[56px_minmax(0,1fr)_72px] gap-x-2 bg-[var(--c-viewer-canvas)] text-text outline-none print:hidden max-[880px]:grid-rows-[56px_minmax(0,1fr)_auto_auto]"
    >
      <div aria-hidden="true" className="col-span-full row-start-1 border-b border-[var(--c-grid-line)] bg-[var(--c-topbar)]" />
      <span className="col-start-1 row-start-1 ml-4 self-center">
        {heading ? (
          <span className="rounded-[3px] border border-line2 px-[5px] py-px font-mono text-[11px] text-faint">
            {heading.kind}
          </span>
        ) : null}
      </span>
      <span className="col-start-2 row-start-1 min-w-0 self-center truncate text-[14px] font-semibold">
        {heading?.title}
      </span>
      <div
        data-zbar="1"
        className={`col-start-3 row-start-1 flex items-center gap-2 self-center max-[880px]:col-span-full max-[880px]:col-start-1 max-[880px]:row-start-4 max-[880px]:justify-between max-[880px]:bg-[var(--c-topbar)] max-[880px]:px-4 max-[880px]:pb-3 ${
          steps ? '' : 'max-[880px]:border-t max-[880px]:border-[var(--c-grid-line)] max-[880px]:pt-3'
        }`}
      >
        {stepGroup}
        {zoomGroup}
      </div>
      <button
        type="button"
        aria-label="Close viewer"
        onClick={onClose}
        className={`col-start-4 row-start-1 mr-3 flex h-10 items-center gap-2 self-center rounded-[4px] border border-line2 bg-transparent px-3 text-[13px] text-text transition-[background-color,transform] duration-[var(--dur-fast)] hover:bg-chip active:scale-[.97] motion-reduce:transition-none max-[880px]:h-11 ${FOCUS_RING}`}
      >
        Close
        <kbd className={`${KBD} text-sub max-[880px]:hidden`}>Esc</kbd>
      </button>

      <PanZoomSurface
        api={pan}
        className="relative col-span-full row-start-2 flex items-center justify-center overflow-hidden bg-[radial-gradient(var(--c-grid-line)_1px,transparent_1px)] bg-[length:16px_16px]"
      >
        {content}
      </PanZoomSurface>

      <div
        data-zbar="1"
        className={`col-span-full row-start-3 flex items-center gap-4 border-t border-[var(--c-grid-line)] bg-[var(--c-topbar)] px-4 max-[880px]:py-3 ${
          steps ? '' : 'max-[880px]:hidden'
        }`}
      >
        {steps ? (
          <>
            <span className="shrink-0 font-mono text-[12px] text-accent-text">{steps.label}</span>
            <span aria-live="polite" className="min-w-0 flex-1 text-[14px] leading-5">
              {steps.text}
            </span>
          </>
        ) : (
          <span className="flex-1" />
        )}
        <span className="flex gap-2.5 whitespace-nowrap text-[12px] text-faint max-[880px]:hidden">
          {steps ? (
            <span>
              <kbd className={KBD}>← →</kbd> step
            </span>
          ) : null}
          <span>
            <kbd className={KBD}>+ −</kbd> zoom
          </span>
          <span>
            <kbd className={KBD}>0</kbd> fit
          </span>
          <span>drag to pan</span>
        </span>
      </div>
    </div>
  )
}
