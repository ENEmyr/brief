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

/**
 * A BlockAnchor with the prefix already folded into the leaf's own path: what a
 * card header takes, since it is handed one finished path rather than the parts
 * to build one from. See CardCaption.
 */
export type CaptionAnchor = Omit<BlockAnchor, 'pathPrefix'>

/** The caption half of DiagramCardProps: the string, and the leaf it came from. */
export interface DiagramCaption extends CaptionAnchor {
  caption: string
  captionPath: string
}

/**
 * Caption for a diagram block, whose caption is always its own `title`. Both
 * halves are derived in one place, the string on screen and the leaf it anchors
 * to, so the two cannot drift apart.
 *
 * `title` is optional on every diagram block, and a block without one shows the
 * `fallback` chrome label instead ('Sequence', 'Diagram', '3D plot'). That label
 * is not in the payload, so it is deliberately NOT annotatable: an anchor at
 * path `title` would name a leaf that does not exist, and the label carries
 * nothing worth annotating anyway.
 */
export function titleCaption(
  { sid, bid, pathPrefix = '', annotatable = true, onMarkClick }: BlockAnchor,
  title: string | undefined,
  fallback: string,
): DiagramCaption {
  return {
    caption: title ?? fallback,
    captionPath: `${pathPrefix}title`,
    sid,
    bid,
    annotatable: annotatable && title !== undefined,
    onMarkClick,
  }
}
