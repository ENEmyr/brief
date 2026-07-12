import { describe, it, expect } from 'vitest'
import { textOffset, selectionRangeIn } from '@/features/annotations'

function makeRange(startNode: Node, startOffset: number, endNode: Node, endOffset: number): Range {
  const range = document.createRange()
  range.setStart(startNode, startOffset)
  range.setEnd(endNode, endOffset)
  return range
}

function fakeSelection(range: Range, text: string, collapsed = false): Selection {
  return {
    isCollapsed: collapsed,
    toString: () => text,
    getRangeAt: () => range,
  } as unknown as Selection
}

describe('textOffset', () => {
  it('counts characters in a single text node from the start of root', () => {
    const root = document.createElement('div')
    root.textContent = 'hello world'
    const textNode = root.firstChild!
    expect(textOffset(root, textNode, 0)).toBe(0)
    expect(textOffset(root, textNode, 6)).toBe(6)
  })

  it('accumulates offsets across nested elements to reach a later text node', () => {
    const root = document.createElement('div')
    root.innerHTML = 'before <b>bold</b> after'
    const boldText = root.querySelector('b')!.firstChild!
    // "before " is 7 chars, so offset 2 inside "bold" is 7 + 2 = 9
    expect(textOffset(root, boldText, 2)).toBe(9)
  })

  it('reaches the second top-level text node correctly', () => {
    const root = document.createElement('div')
    root.innerHTML = 'before <b>bold</b> after'
    const afterText = root.lastChild!
    // "before " (7) + "bold" (4) = 11, offset 1 into " after" = 12
    expect(textOffset(root, afterText, 1)).toBe(12)
  })
})

describe('selectionRangeIn', () => {
  it('returns ordered start/end offsets and the selected text for a forward selection', () => {
    const root = document.createElement('div')
    root.textContent = 'hello world'
    const textNode = root.firstChild!
    const range = makeRange(textNode, 0, textNode, 5)
    const sel = fakeSelection(range, 'hello')
    expect(selectionRangeIn(root, sel)).toEqual({ start: 0, end: 5, text: 'hello' })
  })

  it('orders start/end defensively even if a range reports start after end', () => {
    // A real DOM Range always self-normalizes to startContainer <= endContainer
    // (setEnd before the current start moves the start too), so this can't be
    // reproduced with document.createRange() -- build a minimal range-shaped
    // object instead to exercise selectionRangeIn's own Math.min/max guard.
    const root = document.createElement('div')
    root.textContent = 'hello world'
    const textNode = root.firstChild!
    const range = {
      startContainer: textNode,
      startOffset: 5,
      endContainer: textNode,
      endOffset: 0,
    } as unknown as Range
    const sel = fakeSelection(range, 'hello')
    expect(selectionRangeIn(root, sel)).toEqual({ start: 0, end: 5, text: 'hello' })
  })

  it('returns null for a collapsed selection', () => {
    const root = document.createElement('div')
    root.textContent = 'hello world'
    const textNode = root.firstChild!
    const range = makeRange(textNode, 3, textNode, 3)
    const sel = fakeSelection(range, '', true)
    expect(selectionRangeIn(root, sel)).toBeNull()
  })

  it('returns null for a whitespace-only selection', () => {
    const root = document.createElement('div')
    root.textContent = 'hello   world'
    const textNode = root.firstChild!
    const range = makeRange(textNode, 5, textNode, 8)
    const sel = fakeSelection(range, '   ')
    expect(selectionRangeIn(root, sel)).toBeNull()
  })

  it('computes offsets spanning a nested element', () => {
    const root = document.createElement('div')
    root.innerHTML = 'before <b>bold</b> after'
    const startNode = root.firstChild! // "before "
    const endNode = root.lastChild! // " after"
    const range = makeRange(startNode, 2, endNode, 2)
    const sel = fakeSelection(range, 'fore bold af')
    expect(selectionRangeIn(root, sel)).toEqual({ start: 2, end: 13, text: 'fore bold af' })
  })

  it('treats an element boundary as a child index, not a character offset', () => {
    // A Range boundary is not always a text node. When it is an element,
    // `offset` indexes its CHILD NODES. Selecting next to an existing <mark> is
    // the everyday way to land one. Counting the child index as characters put
    // the anchor somewhere the reader never selected.
    const root = document.createElement('p')
    root.innerHTML = '<mark>Hello</mark> world'
    // Boundary "after child 1" = after the <mark>, i.e. character 5.
    expect(textOffset(root, root, 1)).toBe(5)
    expect(textOffset(root, root, 0)).toBe(0)
  })

  it('returns null for a boundary outside the block instead of clamping to its end', () => {
    // This is what corrupted cross-block selections: the walk fell through and
    // returned the block's full text length, so the stored anchor covered text
    // the reader never selected.
    const root = document.createElement('p')
    root.textContent = 'inside'
    const outside = document.createElement('p')
    outside.textContent = 'elsewhere'
    document.body.append(root, outside)

    expect(textOffset(root, outside.firstChild!, 3)).toBeNull()

    root.remove()
    outside.remove()
  })
})
