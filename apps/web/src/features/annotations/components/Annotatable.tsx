'use client'
import { DEFAULT_HIGHLIGHT_PATH } from '@/features/reader-state'
import type { Highlight } from '@/features/reader-state'
import { HighlightedText } from './HighlightedText'

export interface AnnotatableProps {
  /** The single string this leaf renders. Highlight offsets count into it. */
  text: string
  sid?: number
  /** null for a section heading, which is not a block. */
  bid?: number | null
  /** Dotted path to this leaf within the block. See Highlight.path. */
  path?: string
  as?: 'span' | 'p' | 'div' | 'td' | 'th' | 'li' | 'figcaption'
  className?: string
  annotatable?: boolean
  onMarkClick?: (highlight: Highlight) => void
}

/**
 * One annotatable leaf: a single string the reader can select, highlight, note
 * or ask about.
 *
 * This is the whole reason tables, cards, callouts and headings can be
 * annotated. A highlight anchors to (sid, bid, path, start, end), where the
 * offsets count into ONE leaf string. The write path measures those offsets by
 * walking the DOM, and the read path re-renders the marks by slicing the model
 * string; those two only agree if the element's text content IS exactly the
 * model string it came from. Wrapping each leaf individually makes that true by
 * construction, where a whole-block wrapper would not: a table's flattened DOM
 * text is every cell run together, and a callout's is its title followed by its
 * body, so slicing the model string would land on the wrong characters.
 *
 * `data-hl` is what SelectionToolbar looks for; `data-path` is read straight
 * back off the element at selection time, so nothing has to be recomputed.
 */
export function Annotatable({
  text,
  sid,
  bid = null,
  path = DEFAULT_HIGHLIGHT_PATH,
  as: Tag = 'span',
  className,
  annotatable = true,
  onMarkClick,
}: AnnotatableProps) {
  if (!annotatable || sid === undefined) {
    return <Tag className={className}>{text}</Tag>
  }

  return (
    <Tag
      className={className}
      data-hl=""
      data-sid={sid}
      // Omitted rather than empty for a heading, so the toolbar can tell "no
      // block" from "block 0".
      {...(bid === null ? {} : { 'data-bid': bid })}
      data-path={path}
    >
      <HighlightedText sid={sid} bid={bid} path={path} text={text} onMarkClick={onMarkClick} />
    </Tag>
  )
}
