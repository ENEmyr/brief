'use client'
import { useEffect, useId } from 'react'
import {
  PanZoomSurface,
  ZoomControls,
  useDiagramViewer,
  usePanZoom,
} from '@/features/diagram-viewer'
import { CardCaption } from './CardCaption'
import type { CaptionAnchor } from './blockAnchor'

export interface DiagramCardProps extends CaptionAnchor {
  caption: string
  /** Dotted path to the caption's string within the block. See Highlight.path. */
  captionPath?: string
  controls?: React.ReactNode
  expandable?: boolean
  children: React.ReactNode
}

// Chrome for the pills in a diagram card's header row: this card's own zoom and
// Expand buttons, and ChartExpandButton, which the chart blocks render into the
// same row. The visible pill stays the prototype's small `padding:3px 9px` box;
// the 44px WCAG touch floor comes from a transparent centered ::before, so the
// hit area grows without inflating the header row's height. `print:hidden`
// because none of these controls mean anything on paper.
export const HEADER_BUTTON_CLASS =
  "relative rounded-md border border-line bg-card px-[9px] py-[3px] font-mono text-[10.5px] text-mauve transition-colors hover:border-mauve hover:bg-mauvesoft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mauve before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] print:hidden"

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
 * (see titleCaption).
 */
export function DiagramCard({
  caption,
  captionPath = 'title',
  controls,
  expandable = true,
  children,
  ...anchor
}: DiagramCardProps) {
  const ownerKey = useId()
  const { expandedKey, open, sync } = useDiagramViewer()
  const pan = usePanZoom('inline', expandable)
  const isExpanded = expandedKey === ownerKey

  useEffect(() => {
    if (isExpanded) sync(ownerKey, children)
  }, [isExpanded, sync, ownerKey, children])

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-line bg-card break-inside-avoid">
      <div className="flex items-center justify-between gap-2 border-b border-line2 bg-elev px-3.5 py-[9px]">
        <CardCaption {...anchor} text={caption} path={captionPath} />
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
