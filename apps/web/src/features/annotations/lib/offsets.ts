/** Character offset of (node, offset) within root's flattened text content,
 * counted by walking every SHOW_TEXT node from the start of root — mirrors
 * the prototype's textOffset (Reader.dc.html line 179) exactly. */
export function textOffset(root: Node, node: Node, offset: number): number {
  let total = 0
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  while (current) {
    if (current === node) return total + offset
    total += current.textContent?.length ?? 0
    current = walker.nextNode()
  }
  return total
}

/** Resolves the current window Selection into ordered start/end character
 * offsets within blockEl (a [data-hl] block), plus the selected text.
 * Returns null when the selection is collapsed or whitespace-only. */
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
  return { start: Math.min(start, end), end: Math.max(start, end), text }
}
