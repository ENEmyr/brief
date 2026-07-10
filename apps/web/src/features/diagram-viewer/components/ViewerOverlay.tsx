'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface ViewerOverlayProps {
  content: string | null
  onClose: () => void
}

const MIN_ZOOM = 0.3
const MAX_ZOOM = 6
const BUTTON_ZOOM_FACTOR = 1.3
const WHEEL_ZOOM_FACTOR = 1.15

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

interface Point {
  x: number
  y: number
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-white px-3 text-[15px] leading-none text-[#11111b]"
    >
      {children}
    </button>
  )
}

/**
 * Fullscreen zoom/pan viewer for expanded diagrams. `content` is always the
 * serialized outerHTML of a diagram element this app itself rendered (see
 * useViewer) — never remote or user-supplied HTML — so injecting it via
 * dangerouslySetInnerHTML below does not introduce an XSS surface.
 */
export function ViewerOverlay({ content, onClose }: ViewerOverlayProps) {
  const isOpen = content !== null

  const [z, setZ] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [panning, setPanning] = useState(false)

  // The overlay root IS the dialog (backdrop included), so the toolbar and
  // content panel both live inside the aria-modal subtree.
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const pointersRef = useRef<Map<number, Point>>(new Map())
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const pinchStartRef = useRef<{ dist: number; z: number } | null>(null)
  // Read via a ref inside effects/native listeners so those only need to be
  // (re)wired on open/close, not on every parent re-render that hands us a
  // new inline onClose identity.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const zoomBy = useCallback((factor: number) => {
    setZ((prev) => clamp(prev * factor, MIN_ZOOM, MAX_ZOOM))
  }, [])

  function handleFit() {
    setZ(1)
    setTx(0)
    setTy(0)
  }

  // Dialog a11y + lifecycle: on open, remember whatever had focus so it can
  // be restored on close, move focus into the dialog, and wire Escape to
  // close plus simple Tab containment (same pattern as the TOC drawer in
  // apps/web/src/features/toc/components/Toc.tsx). The cleanup only runs
  // after an open (isOpen was true), so it doubles as the close step:
  // restore focus AND reset all gesture state (pointer maps, pan/pinch
  // anchors, transform) so a leaked pointercancel-less close or a stale
  // transform can never survive into the next open.
  useEffect(() => {
    if (!isOpen) return

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }

      // Simple focus containment: wrap Tab/Shift+Tab between the first and
      // last focusable element inside the dialog. Not a full focus-trap (no
      // live re-scan, no iframe/shadow-DOM support) — sufficient given the
      // dialog's small, static set of focusable children (the four toolbar
      // buttons).
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
      pointersRef.current.clear()
      panStartRef.current = null
      pinchStartRef.current = null
      setZ(1)
      setTx(0)
      setTy(0)
      setPanning(false)
    }
    // Deliberately keyed on isOpen only, so this doesn't re-run (and reset
    // the transform / re-steal focus) on every parent re-render while open.
  }, [isOpen])

  // React attaches its root `wheel` listener as passive, so `preventDefault`
  // inside a React onWheel handler is a silent no-op and the page behind the
  // overlay would scroll. The spec requires the wheel gesture to zoom only,
  // so we bind a native, non-passive listener directly to the overlay node.
  useEffect(() => {
    if (!isOpen) return
    const el = dialogRef.current
    if (!el) return

    function handleWheel(event: WheelEvent) {
      event.preventDefault()
      zoomBy(event.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR)
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [isOpen, zoomBy])

  if (!isOpen) return null

  function isToolbarTarget(event: React.PointerEvent | PointerEvent) {
    return event.target instanceof HTMLElement && event.target.closest('[data-zbar]') !== null
  }

  function handlePointerDown(event: React.PointerEvent) {
    if (isToolbarTarget(event)) return

    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointersRef.current.size === 1) {
      panStartRef.current = { x: event.clientX, y: event.clientY, tx, ty }
      setPanning(true)
    } else if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()]
      if (a && b) {
        pinchStartRef.current = { dist: distance(a, b), z }
      }
    }
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    const [p1, p2] = [...pointersRef.current.values()]
    if (p1 && p2 && pinchStartRef.current) {
      const ratio = distance(p1, p2) / pinchStartRef.current.dist
      setZ(clamp(pinchStartRef.current.z * ratio, MIN_ZOOM, MAX_ZOOM))
    } else if (p1 && !p2 && panStartRef.current) {
      setTx(panStartRef.current.tx + (event.clientX - panStartRef.current.x))
      setTy(panStartRef.current.ty + (event.clientY - panStartRef.current.y))
    }
  }

  function handlePointerUp(event: React.PointerEvent) {
    pointersRef.current.delete(event.pointerId)
    pinchStartRef.current = null

    const [remaining] = [...pointersRef.current.values()]
    if (remaining && pointersRef.current.size === 1) {
      panStartRef.current = { x: remaining.x, y: remaining.y, tx, ty }
    } else {
      panStartRef.current = null
      setPanning(false)
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Diagram viewer"
      tabIndex={-1}
      className="fixed inset-0 z-[100] outline-none print:hidden"
      style={{ background: 'rgba(17,17,27,.93)', touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div data-zbar="1" className="absolute right-[18px] top-4 z-[2] flex gap-1.5">
        <ToolbarButton label="Zoom out" onClick={() => zoomBy(1 / BUTTON_ZOOM_FACTOR)}>
          −
        </ToolbarButton>
        <ToolbarButton label="Zoom in" onClick={() => zoomBy(BUTTON_ZOOM_FACTOR)}>
          +
        </ToolbarButton>
        <ToolbarButton label="Fit to screen" onClick={handleFit}>
          Fit
        </ToolbarButton>
        <ToolbarButton label="Close viewer" onClick={onClose}>
          ✕ Close
        </ToolbarButton>
      </div>

      <div
        className="flex h-full items-center justify-center"
        style={{ cursor: panning ? 'grabbing' : 'grab' }}
      >
        <div
          className="w-[min(80vw,900px)] rounded-[10px] border border-transparent bg-card p-6 shadow-[var(--shadow-card)] [[data-theme=mocha]_&]:border-line"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${z})`,
            transformOrigin: 'center',
          }}
          // See the component doc comment above: content is always our own
          // rendered DOM, never remote/user HTML.
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-black/40 px-3 py-1 text-[12px] text-slate-200">
        Drag to pan · scroll to zoom · Fit to reset
      </div>
    </div>
  )
}
