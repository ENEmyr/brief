'use client'
import { useRef } from 'react'
import { useDiagramViewer } from '@/features/diagram-viewer'

export interface DiagramCardProps {
  caption: string
  controls?: React.ReactNode
  expandable?: boolean
  children: React.ReactNode
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('button,a,input,label,select,textarea') !== null
}

/**
 * Shared chrome for diagram/widget blocks (per Global Constraints "Widget
 * chrome (DiagramCard)"): header row with caption + optional Expand button,
 * a body that hosts the diagram, and an optional controls row below it.
 *
 * Expanding serializes the first `svg` or `[data-expand-root]` element found
 * inside the body via a ref and hands its outerHTML to the diagram-viewer
 * context's open(). If neither exists, expand is a no-op (chart blocks that
 * render a data-URL <img> instead of inline SVG can call
 * useDiagramViewer().open() directly rather than relying on this body scan).
 */
export function DiagramCard({ caption, controls, expandable = true, children }: DiagramCardProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const { open } = useDiagramViewer()

  function handleExpand() {
    const root = bodyRef.current?.querySelector('svg, [data-expand-root]')
    if (!root) return
    open(root.outerHTML)
  }

  function handleBodyClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!expandable) return
    // Controls (step buttons etc.) live outside the body in the controls
    // row, but a future SVG diagram may embed its own interactive elements
    // (state-machine buttons) inside the body — don't hijack those clicks.
    if (isInteractiveTarget(event.target)) return
    handleExpand()
  }

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line2 bg-elev px-3.5 py-[9px]">
        <span className="font-mono text-[10.5px] tracking-[.04em] text-faint">{caption}</span>
        {expandable ? (
          // The visible pill stays exactly the prototype's small
          // `padding:3px 9px` box; the 44px WCAG touch floor is applied via
          // a transparent centered ::before pseudo-element instead of
          // min-h/min-w on the bordered element itself, so the hit area
          // grows without inflating the header row's height.
          <button
            type="button"
            aria-label="Expand diagram"
            onClick={handleExpand}
            className="relative rounded-md border border-line bg-card px-[9px] py-[3px] font-mono text-[10.5px] text-mauve before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
          >
            ⤢ Expand
          </button>
        ) : null}
      </div>
      <div
        ref={bodyRef}
        onClick={handleBodyClick}
        className={`px-4 pb-1.5 pt-4${expandable ? ' cursor-zoom-in' : ''}`}
      >
        {children}
      </div>
      {controls ? <div className="px-3.5 pb-3.5 pt-1.5">{controls}</div> : null}
    </div>
  )
}
