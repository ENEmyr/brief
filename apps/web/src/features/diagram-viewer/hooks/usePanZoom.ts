'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

export const MIN_ZOOM = 0.3
export const MAX_ZOOM = 6
/** The zoom buttons and keys move in 25-point steps (B-Overlays:229-230). */
const ZOOM_STEP = 0.25
const WHEEL_ZOOM_FACTOR = 1.15

interface Point {
  x: number
  y: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

// Snaps to the step grid first, so 30% steps up to 50%, not 55%. The epsilon
// keeps 100% from snapping to itself through float error.
const stepUp = (zoom: number) => Math.floor(zoom / ZOOM_STEP + 1e-6) * ZOOM_STEP + ZOOM_STEP
const stepDown = (zoom: number) => Math.ceil(zoom / ZOOM_STEP - 1e-6) * ZOOM_STEP - ZOOM_STEP

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
  /** Back to 100%, and drop any gesture still in flight (bug-121). */
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

/**
 * Pan and zoom for the fullscreen viewer. The viewer owns the whole screen, so
 * it takes every gesture: a one-finger drag pans, a bare wheel zooms, two
 * pointers pinch, and touch-action is none.
 */
export function usePanZoom(enabled = true): PanZoomApi {
  const [zoom, setZoom] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [panning, setPanning] = useState(false)

  const surfaceRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pointersRef = useRef<Map<number, Point>>(new Map())
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null)

  const zoomTo = useCallback((next: (prev: number) => number) => {
    setZoom((prev) => clamp(next(prev), MIN_ZOOM, MAX_ZOOM))
  }, [])

  const reset = useCallback(() => {
    pointersRef.current.clear()
    panStartRef.current = null
    pinchStartRef.current = null
    setPanning(false)
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
      event.preventDefault()
      // A sideways trackpad swipe has no vertical part and must not zoom.
      if (event.deltaY === 0) return
      zoomTo((prev) => prev * (event.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR))
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [enabled, zoomTo])

  function handlePointerDown(event: React.PointerEvent) {
    if (!enabled || isInteractiveTarget(event.target)) return

    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointersRef.current.size === 1) {
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
    if (remaining && pointersRef.current.size === 1) {
      panStartRef.current = { x: remaining.x, y: remaining.y, tx, ty }
    } else {
      panStartRef.current = null
      setPanning(false)
    }
  }

  const cursor = enabled ? (panning ? 'grabbing' : 'grab') : undefined

  return {
    zoom,
    panning,
    transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
    zoomIn: () => zoomTo(stepUp),
    zoomOut: () => zoomTo(stepDown),
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
      style: { touchAction: 'none', ...(cursor ? { cursor } : {}) },
    },
  }
}
