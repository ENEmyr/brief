import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { Annotatable } from '@/features/annotations'
import { ReaderStateProvider } from '@/features/reader-state'
import type { Highlight } from '@/features/reader-state'

const sessionId = 'sess-overlap'

function renderLeaf(text: string, highlights: Highlight[]) {
  localStorage.setItem(`idocs:${sessionId}`, JSON.stringify({ highlights, dsel: {}, dnote: {} }))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
  const { container } = render(
    <ReaderStateProvider sessionId={sessionId}>
      <Annotatable as="p" text={text} sid={0} bid={0} path="text" markdown />
    </ReaderStateProvider>,
  )
  return container.querySelector('p') as HTMLParagraphElement
}

const hl = (id: string, start: number, end: number, text: string, extra: Partial<Highlight> = {}) =>
  ({ id, sid: 0, bid: 0, path: 'text', start, end, text, note: null, ...extra }) as Highlight

function marks(p: Element) {
  return [...p.querySelectorAll('mark')].map((m) => [m.dataset.markId, m.textContent, m.dataset.marker ?? null])
}

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('nested annotations', () => {
  const src = 'abc **defg** hij'

  it('draws a highlight inside an earlier one as its own mark', () => {
    const p = renderLeaf(src, [hl('outer', 0, 16, src), hl('inner', 6, 8, 'de')])
    expect(p.textContent).toBe(src)
    expect(marks(p)).toEqual([
      ['outer', 'abc ', null],
      ['inner', 'de', null],
      ['outer', 'fg', null],
      ['outer', ' hij', null],
    ])
  })

  it('keeps the marker of a note or ask inside an earlier highlight', () => {
    const p = renderLeaf(src, [
      hl('outer', 0, 16, src),
      hl('note', 6, 7, 'd', { note: 'n' }),
      hl('ask', 13, 15, 'hi', { question: 'q' }),
    ])
    expect(marks(p)).toEqual([
      ['outer', 'abc ', null],
      ['note', 'd', 'note'],
      ['outer', 'efg', null],
      ['outer', ' ', null],
      ['ask', 'hi', 'ask'],
      ['outer', 'j', null],
    ])
  })

  it('keeps the outer marker on its last visible piece when a nested mark ends the range', () => {
    const p = renderLeaf(src, [hl('outer', 0, 16, src, { note: 'o' }), hl('inner', 13, 16, 'hij')])
    expect(marks(p)).toEqual([
      ['outer', 'abc ', null],
      ['outer', 'defg', null],
      ['outer', ' ', 'note'],
      ['inner', 'hij', null],
    ])
  })
})

describe('a highlight on marker characters only', () => {
  it('draws the marker it was stored on, with its note marker', () => {
    const src = 'run `npm ci` now'
    const p = renderLeaf(src, [hl('tick', 4, 5, '`', { note: 'n' })])
    expect(p.textContent).toBe(src)
    const mark = p.querySelector('mark[data-mark-id="tick"]')
    expect(mark?.textContent).toBe('`')
    expect(mark?.closest('[hidden]')).toBeNull()
    expect(mark).toHaveAttribute('data-marker', 'note')
  })
})
