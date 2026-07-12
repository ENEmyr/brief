/** Characters of root's flattened text that precede target's subtree. Null when
 *  target is not inside root. */
function charsBefore(root: Node, target: Node): number | null {
  if (!root.contains(target)) return null
  let total = 0
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  while (current) {
    if (target.contains(current)) return total
    total += current.textContent?.length ?? 0
    current = walker.nextNode()
  }
  // target holds no text of its own (an empty element at the end, say).
  return total
}

/**
 * Character offset of a Range boundary (node, offset) within root's flattened
 * text. Returns null when node is not inside root: the caller must not treat an
 * out-of-block boundary as "the very end of the block".
 *
 * A Range boundary is not always a text node. When it is an ELEMENT, `offset`
 * is an index into its child nodes, not a character count, and the two must not
 * be conflated. Selecting text next to an existing <mark> is the everyday way to
 * land one: the browser hands back the containing element rather than a text
 * node. Counting an element's child index as if it were a character offset put
 * the anchor somewhere the reader never selected.
 */
export function textOffset(root: Node, node: Node, offset: number): number | null {
  const before = charsBefore(root, node)
  if (before === null) return null

  if (node.nodeType === Node.ELEMENT_NODE) {
    let chars = 0
    for (let i = 0; i < offset && i < node.childNodes.length; i++) {
      chars += node.childNodes[i]?.textContent?.length ?? 0
    }
    return before + chars
  }

  return before + offset
}

/**
 * Resolves the current window Selection into ordered start/end character
 * offsets within blockEl (a [data-hl] leaf), plus the selected text. Returns
 * null when the selection is collapsed, whitespace-only, or reaches outside
 * blockEl.
 *
 * That last case used to corrupt silently: the walk fell through and returned
 * the block's full text length, so a selection dragged from one paragraph into
 * the next was stored as "from my start offset to the end of the first block" —
 * an anchor covering text the reader never selected. An anchor addresses one
 * leaf, so a selection spanning two of them has no honest answer; refusing is
 * the correct one.
 */
export function selectionRangeIn(
  blockEl: HTMLElement,
  sel: Selection,
): { start: number; end: number; text: string } | null {
  if (sel.isCollapsed) return null
  const text = sel.toString()
  if (!text.trim()) return null
  const range = sel.getRangeAt(0)
  const start = textOffset(blockEl, range.startContainer, range.startOffset)
  const end = textOffset(blockEl, range.endContainer, range.endOffset)
  if (start === null || end === null) return null
  return { start: Math.min(start, end), end: Math.max(start, end), text }
}
