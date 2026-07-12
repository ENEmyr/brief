import type { Highlight } from '@/features/reader-state'

/**
 * Where a block's leaves live in the payload: which section, which block, and
 * (for a block nested inside a details) the dotted prefix its leaves hang
 * under. BlockRenderer builds one of these and hands the same object to every
 * block it renders, text and diagram alike.
 */
export interface BlockAnchor {
  sid?: number
  bid?: number
  /** Set for a nested block, so its leaves are addressed under `blocks.<i>.`. */
  pathPrefix?: string
  annotatable?: boolean
  onMarkClick?: (highlight: Highlight) => void
}

/** The anchor half of DiagramCardProps: what the card needs to make its caption
 *  an annotatable leaf. */
export interface CaptionAnchor {
  sid?: number
  bid?: number
  /** Dotted path to the caption's string within the block. See Highlight.path. */
  captionPath?: string
  annotatable?: boolean
  onMarkClick?: (highlight: Highlight) => void
}

/**
 * Caption anchor for a diagram whose caption is the block's own `title`.
 *
 * `title` is optional on every diagram block, and a block without one shows a
 * fixed chrome label instead ('Sequence', 'Diagram', '3D plot'). That label is
 * not in the payload, so it is deliberately NOT annotatable: an anchor at path
 * `title` would name a leaf that does not exist, and the label carries nothing
 * worth annotating anyway.
 */
export function titleAnchor(
  { sid, bid, pathPrefix = '', annotatable = true, onMarkClick }: BlockAnchor,
  title: string | undefined,
): CaptionAnchor {
  return {
    sid,
    bid,
    captionPath: `${pathPrefix}title`,
    annotatable: annotatable && title !== undefined,
    onMarkClick,
  }
}
