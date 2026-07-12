'use client'
import type { PanZoomApi } from '../hooks/usePanZoom'

export interface PanZoomSurfaceProps {
  api: PanZoomApi
  className?: string
  contentClassName?: string
  children: React.ReactNode
}

/**
 * The two halves a pan/zoom needs: a fixed surface that receives the gestures,
 * and a content box that carries the transform. Both the inline DiagramCard
 * body and the fullscreen ViewerOverlay render through this, so the gesture
 * behaviour cannot drift between them.
 */
export function PanZoomSurface({ api, className, contentClassName, children }: PanZoomSurfaceProps) {
  return (
    <div
      ref={api.surfaceRef}
      className={className}
      {...api.surfaceProps}
      style={api.surfaceProps.style}
    >
      <div
        ref={api.contentRef}
        className={contentClassName}
        style={{ transform: api.transform, transformOrigin: 'center' }}
      >
        {children}
      </div>
    </div>
  )
}

export interface ZoomControlsProps {
  api: PanZoomApi
  /** Rendered inside a `data-zbar` wrapper so pointerdown on a control never
   *  starts a pan (see usePanZoom's isInteractiveTarget). */
  className?: string
  buttonClassName: string
  /**
   * `fit` scales the content to fill the surface, which is what the fullscreen
   * overlay wants: you expanded the diagram to see it bigger.
   *
   * `reset` returns to 1:1. That is what the inline card wants, because there
   * the content already fills its box, so a measured fit would land on a value
   * near but not exactly 1 and read as a broken button.
   */
  action?: 'fit' | 'reset'
}

export function ZoomControls({
  api,
  className,
  buttonClassName,
  action = 'fit',
}: ZoomControlsProps) {
  const isFit = action === 'fit'
  return (
    <div data-zbar="1" className={className}>
      <button type="button" aria-label="Zoom out" onClick={api.zoomOut} className={buttonClassName}>
        −
      </button>
      <button type="button" aria-label="Zoom in" onClick={api.zoomIn} className={buttonClassName}>
        +
      </button>
      <button
        type="button"
        aria-label={isFit ? 'Fit to screen' : 'Reset zoom'}
        onClick={isFit ? api.fit : api.reset}
        className={buttonClassName}
      >
        {isFit ? 'Fit' : 'Reset'}
      </button>
    </div>
  )
}
