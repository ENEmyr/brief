import { describe, it, expect } from 'vitest'
import type { Element } from 'hast'
import type { Highlight } from '@/features/reader-state'
import {
  extractLineNodes,
  highlightsForLine,
  lineText,
  renderLineChildren,
  sameHighlightList,
} from '@/features/reader/components/blocks/codeLines'
import { highlightToHast } from '@/features/reader/services/shiki'

function tokenSpan(text: string, style: string): Element {
  return { type: 'element', tagName: 'span', properties: { style }, children: [{ type: 'text', value: text }] }
}

function highlight(overrides: Partial<Highlight> & Pick<Highlight, 'start' | 'end' | 'text'>): Highlight {
  return { id: 'h1', sid: 0, bid: 0, path: 'code.0', note: null, ...overrides }
}

describe('extractLineNodes / lineText (anchor invariant)', () => {
  it('gives one line node per entry of code.split("\\n"), text-identical to the source', async () => {
    const code = 'const a = 1\n\nfunction f() {\n\treturn a\n}\n'
    const hast = await highlightToHast(code, 'javascript')
    const nodes = extractLineNodes(hast)
    const expected = code.split('\n')

    expect(nodes).toHaveLength(expected.length)
    nodes.forEach((node, i) => {
      expect(lineText(node)).toBe(expected[i])
    })
  })

  it('gives an empty line node empty flattened text', async () => {
    // shiki isn't consistent about *how* an empty line is empty -- a
    // tokenized language gives it zero children, but the plaintext ('text')
    // tokenizer still wraps it in a token span holding an empty string --
    // so "empty" has to be judged by lineText, never by children.length.
    const untokenized = await highlightToHast('a\n\nb', 'text')
    expect(lineText(extractLineNodes(untokenized)[1]!)).toBe('')

    const tokenized = await highlightToHast('a\n\nb', 'javascript')
    expect(lineText(extractLineNodes(tokenized)[1]!)).toBe('')
  })
})

describe('renderLineChildren', () => {
  const line: Element = {
    type: 'element',
    tagName: 'span',
    properties: { class: 'line' },
    children: [tokenSpan('foo', 'color:red'), tokenSpan('bar', 'color:blue')],
  }

  it('returns the original children untouched when there is nothing to highlight', () => {
    expect(renderLineChildren(line, [])).toBe(line.children)
  })

  it('splits a mark across a token boundary and keeps each side\'s own color', () => {
    // "foobar", highlighting chars 1..5 ("ooba"): the mark starts inside the
    // red "foo" token and ends inside the blue "bar" token, so a correct
    // renderer must split BOTH tokens at the mark boundary, not just wrap
    // whichever token happens to contain the whole range.
    const h = highlight({ start: 1, end: 5, text: 'ooba' })
    const out = renderLineChildren(line, [h])

    // Structure: "f"(red) , <mark>"oo"(red) "ba"(blue)</mark> , "r"(blue)
    expect(out).toHaveLength(3)

    const [before, mark, after] = out as [Element, Element, Element]
    expect(before.tagName).toBe('span')
    expect(before.properties?.style).toBe('color:red')
    expect((before.children[0] as { value: string }).value).toBe('f')

    expect(mark.tagName).toBe('mark')
    expect(mark.properties?.['data-highlight-id']).toBe('h1')
    const markSpans = mark.children as Element[]
    expect(markSpans[0]!.properties?.style).toBe('color:red')
    expect((markSpans[0]!.children[0] as { value: string }).value).toBe('oo')
    expect(markSpans[1]!.properties?.style).toBe('color:blue')
    expect((markSpans[1]!.children[0] as { value: string }).value).toBe('ba')

    expect(after.properties?.style).toBe('color:blue')
    expect((after.children[0] as { value: string }).value).toBe('r')
  })

  it('appends an ask marker inside the mark for a question highlight', () => {
    const h = highlight({ start: 0, end: 3, text: 'foo', question: 'why?' })
    const out = renderLineChildren(line, [h])
    const mark = out[0] as Element
    const sup = mark.children[mark.children.length - 1] as Element
    expect(sup.tagName).toBe('sup')
    expect((sup.children[0] as { value: string }).value).toBe('?')
  })

  it('appends a note marker inside the mark for a note highlight', () => {
    const h = highlight({ start: 0, end: 3, text: 'foo', note: 'a note' })
    const out = renderLineChildren(line, [h])
    const mark = out[0] as Element
    const sup = mark.children[mark.children.length - 1] as Element
    expect((sup.children[0] as { value: string }).value).toBe('●')
  })
})

describe('highlightsForLine', () => {
  const text = 'const a = 1'

  it('matches on sid/bid/path and drops a stale anchor whose text no longer fits', () => {
    const stale = highlight({ start: 0, end: 5, text: 'WRONG' })
    const good = highlight({ start: 0, end: 5, text: 'const' })
    const otherPath = highlight({ start: 0, end: 5, text: 'const', path: 'code.1' })

    expect(highlightsForLine([stale, good, otherPath], 0, 0, 'code.0', text)).toEqual([good])
  })

  it('never matches when sid is undefined (not addressable)', () => {
    const h = highlight({ start: 0, end: 5, text: 'const' })
    expect(highlightsForLine([h], undefined, 0, 'code.0', text)).toEqual([])
  })
})

describe('sameHighlightList', () => {
  it('is true for the same array and for two different arrays with identical elements in order', () => {
    const h = highlight({ start: 0, end: 1, text: 'c' })
    expect(sameHighlightList([h], [h])).toBe(true)
  })

  it('is false when an element differs or the length differs', () => {
    const h1 = highlight({ start: 0, end: 1, text: 'c' })
    const h2 = highlight({ start: 0, end: 1, text: 'c', id: 'h2' })
    expect(sameHighlightList([h1], [h2])).toBe(false)
    expect(sameHighlightList([h1], [h1, h2])).toBe(false)
  })
})
