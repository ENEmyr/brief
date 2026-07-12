'use client'
import { Annotatable } from '@/features/annotations'
import type { CaptionAnchor } from './blockAnchor'

export interface CardCaptionProps extends CaptionAnchor {
  /** The single string the header shows. Highlight offsets count into it. */
  text: string
  /** Dotted path to `text` within the block. See Highlight.path. */
  path: string
}

/**
 * The caption in a figure's header bar. DiagramCard's title, CodeBlock's
 * filename and BeforeAfter's side title all render through this, so the three
 * headers keep one look and one rule for when a caption is a leaf the reader
 * can annotate.
 *
 * The caption wraps rather than truncating. CSS truncation would keep the DOM
 * text intact, so the anchor offsets would still be honest, but a <mark> that
 * lands in the clipped tail would be invisible: a highlight the reader made and
 * can no longer see.
 */
export function CardCaption({
  text,
  path,
  sid,
  bid,
  annotatable = true,
  onMarkClick,
}: CardCaptionProps) {
  return (
    <Annotatable
      className="min-w-0 break-words font-mono text-[10.5px] tracking-[.04em] text-faint"
      text={text}
      sid={sid}
      // A caption always belongs to a block, never to a section heading, so a
      // missing bid means "not addressable" rather than "heading".
      bid={bid ?? null}
      path={path}
      annotatable={annotatable && bid !== undefined}
      onMarkClick={onMarkClick}
    />
  )
}
