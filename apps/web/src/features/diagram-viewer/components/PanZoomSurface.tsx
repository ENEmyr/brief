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
 * and a content box that carries the transform.
 */
export function PanZoomSurface({ api, className, contentClassName, children }: PanZoomSurfaceProps) {
  return (
    <div ref={api.surfaceRef} className={className} {...api.surfaceProps} style={api.surfaceProps.style}>
      {/* data-panzoom-content is the print stylesheet's handle on this box: the
          transform is an inline style, so only a targeted `!important` rule can
          reset it. A zoom eases in (B-Overlays:16); a drag follows the pointer. */}
      <div
        ref={api.contentRef}
        data-panzoom-content=""
        className={`${contentClassName ?? ''} ${
          api.panning ? '' : 'transition-transform duration-[var(--dur-base)] ease-console motion-reduce:transition-none'
        }`}
        style={{ transform: api.transform, transformOrigin: 'center' }}
      >
        {children}
      </div>
    </div>
  )
}
