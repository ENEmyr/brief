'use client'
import { useEffect, useId } from 'react'
import { Annotatable } from '@/features/annotations'
import {
  PanZoomSurface,
  ZoomControls,
  useDiagramViewer,
  usePanZoom,
} from '@/features/diagram-viewer'
import type { CaptionAnchor } from './blockAnchor'

export interface DiagramCardProps extends CaptionAnchor {
  caption: string
  controls?: React.ReactNode
  expandable?: boolean
  children: React.ReactNode
}

// The visible pill stays the prototype's small `padding:3px 9px` box; the 44px
// WCAG touch floor comes from a transparent centered ::before, so the hit area
// grows without inflating the header row's height.
const HEADER_BUTTON_CLASS =
  "relative rounded-md border border-line bg-card px-[9px] py-[3px] font-mono text-[10.5px] text-mauve transition-colors hover:border-mauve hover:bg-mauvesoft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mauve before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"

/**
 * Shared chrome for diagram/widget blocks: a header row with the caption, zoom
 * controls and an Expand button, a pan/zoom body that hosts the diagram, and an
 * optional controls row below it.
 *
 * Expanding is deliberately reachable ONLY from the Expand button. The body
 * used to expand on any click, which surprised readers who meant to interact
 * with the diagram, and it left no gesture budget for panning in place.
 *
 * The expanded copy is this card's live `children`, handed to the viewer as a
 * React node rather than as serialized outerHTML. The effect below re-syncs it
 * while this card owns the viewer, so a diagram whose state lives in its parent
 * (a Seq's current step, a StateMachine's current state) stays in step with the
 * page instead of freezing at whatever it showed when Expand was pressed.
 *
 * The caption is one annotatable leaf when the card is given an anchor: a
 * diagram's title is often the only prose on the card, and it was the one bit
 * of a diagram block a reader could not question. It is plain chrome text when
 * no anchor is passed, which is also what a block without a real title gets
 * (see titleAnchor).
 *
 * The caption wraps rather than truncating. CSS truncation would keep the DOM
 * text intact, so the anchor offsets would still be honest, but a <mark> that
 * lands in the clipped tail would be invisible - a highlight the reader made
 * and can no longer see.
 */
export function DiagramCard({
  caption,
  controls,
  expandable = true,
  sid,
  bid,
  captionPath = 'title',
  annotatable = true,
  onMarkClick,
  children,
}: DiagramCardProps) {
  const ownerKey = useId()
  const { expandedKey, open, sync } = useDiagramViewer()
  const pan = usePanZoom('inline', expandable)
  const isExpanded = expandedKey === ownerKey

  useEffect(() => {
    if (isExpanded) sync(ownerKey, children)
  }, [isExpanded, sync, ownerKey, children])

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-line bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-line2 bg-elev px-3.5 py-[9px]">
        <Annotatable
          className="min-w-0 break-words font-mono text-[10.5px] tracking-[.04em] text-faint"
          text={caption}
          sid={sid}
          bid={bid ?? null}
          path={captionPath}
          // A caption always belongs to a block, never to a section heading, so
          // a missing bid means "not addressable" rather than "heading".
          annotatable={annotatable && bid !== undefined}
          onMarkClick={onMarkClick}
        />
        {expandable ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <ZoomControls
              api={pan}
              className="flex gap-1.5"
              buttonClassName={HEADER_BUTTON_CLASS}
              action="reset"
            />
            <button
              type="button"
              aria-label="Expand diagram"
              onClick={() => open(ownerKey, children)}
              className={HEADER_BUTTON_CLASS}
            >
              ⤢ Expand
            </button>
          </div>
        ) : null}
      </div>
      <PanZoomSurface
        api={pan}
        className="overflow-hidden px-4 pb-1.5 pt-4"
        contentClassName="w-full"
      >
        {children}
      </PanZoomSurface>
      {controls ? <div className="px-3.5 pb-3.5 pt-1.5">{controls}</div> : null}
    </div>
  )
}
