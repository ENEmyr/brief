'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

export const MIN_ZOOM = 0.3
export const MAX_ZOOM = 6
export const BUTTON_ZOOM_FACTOR = 1.3
export const WHEEL_ZOOM_FACTOR = 1.15

/**
 * `overlay` owns the whole screen, so it can take every gesture: one-finger
 * drag pans, a bare wheel zooms, and touch-action is none.
 *
 * `inline` lives inside a scrolling document, so it must not steal the
 * gestures the reader uses to get past it. A bare wheel scrolls the page and
 * only ctrl/cmd+wheel zooms (the same contract embedded maps use); a drag pans
 * only once zoomed in, so at rest a drag near the diagram still selects text;
 * and touch-action stays pan-y so one finger always scrolls the page. Pinch
 * works in both, because a second pointer is unambiguous.
 */
export type PanZoomMode = 'inline' | 'overlay'

interface Point {
  x: number
  y: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest('button,a,input,label,select,textarea,[data-zbar]') !== null
  )
}

export interface PanZoomApi {
  zoom: number
  panning: boolean
  transform: string
  zoomIn: () => void
  zoomOut: () => void
  /** Scale the content so it fills its surface. Falls back to a plain reset
   *  when either box measures zero (jsdom, or a not-yet-laid-out surface). */
  fit: () => void
  reset: () => void
  surfaceRef: React.RefObject<HTMLDivElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
  surfaceProps: {
    onPointerDown: (event: React.PointerEvent) => void
    onPointerMove: (event: React.PointerEvent) => void
    onPointerUp: (event: React.PointerEvent) => void
    onPointerCancel: (event: React.PointerEvent) => void
    onPointerLeave: (event: React.PointerEvent) => void
    style: React.CSSProperties
  }
}

export function usePanZoom(mode: PanZoomMode, enabled = true): PanZoomApi {
  const [zoom, setZoom] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [panning, setPanning] = useState(false)

  const surfaceRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pointersRef = useRef<Map<number, Point>>(new Map())
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null)

  const zoomBy = useCallback((factor: number) => {
    setZoom((prev) => clamp(prev * factor, MIN_ZOOM, MAX_ZOOM))
  }, [])

  const reset = useCallback(() => {
    setZoom(1)
    setTx(0)
    setTy(0)
  }, [])

  const fit = useCallback(() => {
    const surface = surfaceRef.current
    const content = contentRef.current
    if (!surface || !content) {
      reset()
      return
    }
    // offsetWidth/Height are layout boxes, so they are unaffected by the
    // transform we are about to replace. getBoundingClientRect would report
    // the already-scaled box and make fit() depend on its own output.
    const sw = surface.clientWidth
    const sh = surface.clientHeight
    const cw = content.offsetWidth
    const ch = content.offsetHeight
    if (!sw || !sh || !cw || !ch) {
      reset()
      return
    }
    setZoom(clamp(Math.min(sw / cw, sh / ch), MIN_ZOOM, MAX_ZOOM))
    setTx(0)
    setTy(0)
  }, [reset])

  // React binds its root wheel listener as passive, so preventDefault inside a
  // React onWheel handler is a silent no-op. Bind natively to opt out.
  useEffect(() => {
    const el = surfaceRef.current
    if (!el || !enabled) return

    function handleWheel(event: WheelEvent) {
      // Inline: a bare wheel belongs to the page. Only a deliberate
      // ctrl/cmd+wheel (which is also what a trackpad pinch emits) zooms.
      if (mode === 'inline' && !event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      zoomBy(event.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR)
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [mode, enabled, zoomBy])

  // Panning inline is only offered once the content is bigger than its box;
  // at rest the surface must stay transparent to selection and page scrolling.
  const canPan = mode === 'overlay' || zoom > 1

  function handlePointerDown(event: React.PointerEvent) {
    if (!enabled || isInteractiveTarget(event.target)) return

    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointersRef.current.size === 1) {
      if (!canPan) return
      panStartRef.current = { x: event.clientX, y: event.clientY, tx, ty }
      setPanning(true)
    } else if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()]
      if (a && b) pinchStartRef.current = { dist: distance(a, b), zoom }
    }
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    const [p1, p2] = [...pointersRef.current.values()]
    if (p1 && p2 && pinchStartRef.current) {
      const ratio = distance(p1, p2) / pinchStartRef.current.dist
      setZoom(clamp(pinchStartRef.current.zoom * ratio, MIN_ZOOM, MAX_ZOOM))
    } else if (p1 && !p2 && panStartRef.current) {
      setTx(panStartRef.current.tx + (event.clientX - panStartRef.current.x))
      setTy(panStartRef.current.ty + (event.clientY - panStartRef.current.y))
    }
  }

  function handlePointerUp(event: React.PointerEvent) {
    pointersRef.current.delete(event.pointerId)
    pinchStartRef.current = null

    // A pinch whose second finger lifts (or is cancelled by palm rejection)
    // must hand over to a pan anchored at the survivor, not keep pinching.
    const [remaining] = [...pointersRef.current.values()]
    if (remaining && pointersRef.current.size === 1 && canPan) {
      panStartRef.current = { x: remaining.x, y: remaining.y, tx, ty }
    } else {
      panStartRef.current = null
      setPanning(false)
    }
  }

  const cursor = !enabled || !canPan ? undefined : panning ? 'grabbing' : 'grab'

  return {
    zoom,
    panning,
    transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
    zoomIn: () => zoomBy(BUTTON_ZOOM_FACTOR),
    zoomOut: () => zoomBy(1 / BUTTON_ZOOM_FACTOR),
    fit,
    reset,
    surfaceRef,
    contentRef,
    surfaceProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onPointerLeave: handlePointerUp,
      style: {
        touchAction: mode === 'overlay' ? 'none' : 'pan-y',
        ...(cursor ? { cursor } : {}),
      },
    },
  }
}
