import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { HighlightedText } from '@/features/annotations'
import { ReaderStateProvider } from '@/features/reader-state'
import type { Highlight } from '@/features/reader-state'

const sessionId = 'sess-overlap-leaf'

function renderLeaf(text: string, highlights: Highlight[], markdown = false) {
  localStorage.setItem(`idocs:${sessionId}`, JSON.stringify({ highlights, dsel: {}, dnote: {} }))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
  const onMarkClick = vi.fn<(h: Highlight) => void>()
  const { container } = render(
    <ReaderStateProvider sessionId={sessionId}>
      <td>
        <HighlightedText sid={0} bid={0} path="text" text={text} markdown={markdown} onMarkClick={onMarkClick} />
      </td>
    </ReaderStateProvider>,
  )
  return { cell: container.querySelector('td') as HTMLTableCellElement, onMarkClick }
}

const hl = (id: string, start: number, end: number, text: string, extra: Partial<Highlight> = {}) =>
  ({ id, sid: 0, bid: 0, path: 'text', start, end, text, note: null, ...extra }) as Highlight

const marks = (el: Element) =>
  [...el.querySelectorAll('mark')].map((m) => [m.dataset.markId, m.textContent, m.dataset.marker ?? null])

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('plain leaf with overlapping highlights', () => {
  it('renders each character once when two highlights partly overlap', () => {
    const { cell } = renderLeaf('hello world', [hl('a', 0, 8, 'hello wo'), hl('b', 4, 11, 'o world')])
    expect(cell.textContent).toBe('hello world')
    expect(marks(cell)).toEqual([
      ['a', 'hello wo', null],
      ['b', 'rld', null],
    ])
    const range = document.createRange()
    range.selectNodeContents(cell)
    expect(range.toString()).toBe('hello world')
  })

  it('draws a nested highlight as its own mark between two pieces of the outer one', () => {
    const { cell } = renderLeaf('hello world', [hl('outer', 0, 11, 'hello world', { note: 'n' }), hl('inner', 2, 4, 'll')])
    expect(cell.textContent).toBe('hello world')
    expect(marks(cell)).toEqual([
      ['outer', 'he', null],
      ['inner', 'll', null],
      ['outer', 'o world', 'note'],
    ])
  })
})

describe('two highlights with an identical range', () => {
  for (const markdown of [false, true]) {
    it(`keeps both reachable (markdown ${markdown})`, () => {
      const { cell, onMarkClick } = renderLeaf(
        'abc def',
        [hl('first', 0, 3, 'abc', { note: 'kept' }), hl('second', 0, 3, 'abc')],
        markdown,
      )
      expect(cell.textContent).toBe('abc def')
      expect(marks(cell)).toEqual([
        ['first', 'abc', 'note'],
        ['second', 'abc', null],
      ])
      const [outer, inner] = [...cell.querySelectorAll('mark')]
      expect(outer?.children.length).toBe(1)
      expect(inner?.parentElement).toBe(outer)
      fireEvent.click(inner!)
      expect(onMarkClick.mock.calls.map(([h]) => h.id)).toEqual(['second'])
      fireEvent.click(outer!)
      expect(onMarkClick.mock.calls.map(([h]) => h.id)).toEqual(['second', 'first'])
    })
  }
})

describe('click guard on a mark', () => {
  it('opens the mark when the pointer moves 4 px or less, and not when it moves more', () => {
    const { cell, onMarkClick } = renderLeaf('abc def', [hl('a', 0, 3, 'abc')])
    const mark = cell.querySelector('mark')!
    fireEvent.mouseDown(mark, { clientX: 10, clientY: 10 })
    fireEvent.click(mark, { clientX: 11, clientY: 10 })
    fireEvent.mouseDown(mark, { clientX: 10, clientY: 10 })
    fireEvent.click(mark, { clientX: 14, clientY: 10 })
    expect(onMarkClick).toHaveBeenCalledTimes(2)
    fireEvent.mouseDown(mark, { clientX: 10, clientY: 10 })
    fireEvent.click(mark, { clientX: 13, clientY: 14 })
    expect(onMarkClick).toHaveBeenCalledTimes(2)
  })
})
