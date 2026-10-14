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
