import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HighlightedText } from '@/features/annotations'
import { ReaderStateProvider } from '@/features/reader-state'
import type { Highlight } from '@/features/reader-state'

const sessionId = 'sess-marks-test'

function seedHighlights(highlights: Highlight[]) {
  localStorage.setItem(`idocs:${sessionId}`, JSON.stringify({ highlights, dsel: {}, dnote: {} }))
}

function renderText(text: string) {
  return render(
    <ReaderStateProvider sessionId={sessionId}>
      <HighlightedText sid={0} bid={0} text={text} />
    </ReaderStateProvider>,
  )
}

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('HighlightedText', () => {
  it('renders plain text unchanged when there are no highlights', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
    seedHighlights([])
    renderText('hello world')
    expect(screen.getByText('hello world')).toBeInTheDocument()
    expect(document.querySelector('mark')).toBeNull()
  })

  it('wraps a single highlighted span in a mark with the highlight styling', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
    seedHighlights([
      { id: 'h1', sid: 0, bid: 0, start: 6, end: 11, text: 'world', note: null },
    ])
    renderText('hello world')
    const mark = document.querySelector('mark')
    expect(mark).not.toBeNull()
    expect(mark?.textContent).toContain('world')
    expect(mark).toHaveStyle({ background: 'var(--ctp-mark)', color: 'var(--ctp-marktx)' })
    // surrounding plain text stays outside the mark
    expect(screen.getByText('hello', { exact: false })).toBeInTheDocument()
  })

  it('renders multiple non-overlapping highlights as separate marks in order', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
    seedHighlights([
      { id: 'h2', sid: 0, bid: 0, start: 6, end: 11, text: 'world', note: null },
      { id: 'h1', sid: 0, bid: 0, start: 0, end: 5, text: 'hello', note: null },
    ])
    renderText('hello world')
    const marks = document.querySelectorAll('mark')
    expect(marks).toHaveLength(2)
    expect(marks[0]?.textContent).toContain('hello')
    expect(marks[1]?.textContent).toContain('world')
  })

  it('keeps the leaf text equal to the model string when a noted mark precedes a plain one', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
    seedHighlights([
      { id: 'h1', sid: 0, bid: 0, start: 0, end: 5, text: 'hello', note: 'a note' },
      { id: 'h2', sid: 0, bid: 0, start: 6, end: 11, text: 'world', note: null },
    ])
    const { container } = renderText('hello world')
    const marks = [...document.querySelectorAll('mark')].map((m) => m.textContent)
    expect(marks).toEqual(['hello', 'world'])
    expect(container.textContent).toBe('hello world')
  })

  it('only includes highlights for the matching sid/bid', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
    seedHighlights([
      { id: 'h1', sid: 1, bid: 0, start: 0, end: 5, text: 'hello', note: null },
      { id: 'h2', sid: 0, bid: 1, start: 0, end: 5, text: 'hello', note: null },
    ])
    renderText('hello world')
    expect(document.querySelector('mark')).toBeNull()
  })

  it('renders overlapping highlights without crashing', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
    seedHighlights([
      { id: 'h1', sid: 0, bid: 0, start: 0, end: 8, text: 'hello wo', note: null },
      { id: 'h2', sid: 0, bid: 0, start: 4, end: 11, text: 'o world', note: null },
    ])
    renderText('hello world')
    const marks = document.querySelectorAll('mark')
    expect(marks).toHaveLength(2)
  })

  it('marks an ask highlight for the "?" marker (question defined), with no marker text', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
    seedHighlights([
      { id: 'h1', sid: 0, bid: 0, start: 0, end: 5, text: 'hello', note: null, question: 'why?' },
    ])
    renderText('hello world')
    const mark = document.querySelector('mark')!
    expect(mark).toHaveAttribute('data-marker', 'ask')
    expect(mark.textContent).toBe('hello')
    expect(mark).toHaveClass('bg-mauvesoft', 'text-mauve')
  })

  it('marks a note highlight for the "●" marker (note non-null, no question), with no marker text', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
    seedHighlights([{ id: 'h1', sid: 0, bid: 0, start: 0, end: 5, text: 'hello', note: 'a note' }])
    renderText('hello world')
    const mark = document.querySelector('mark')!
    expect(mark).toHaveAttribute('data-marker', 'note')
    expect(mark.textContent).toBe('hello')
  })

  it('gives a plain highlight no marker (note null, no question)', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
    seedHighlights([{ id: 'h1', sid: 0, bid: 0, start: 0, end: 5, text: 'hello', note: null }])
    renderText('hello world')
    const mark = document.querySelector('mark')!
    expect(mark.textContent).toBe('hello')
    expect(mark).not.toHaveAttribute('data-marker')
  })

  it('calls onMarkClick with the highlight when a mark is clicked', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
    const highlight: Highlight = { id: 'h1', sid: 0, bid: 0, start: 0, end: 5, text: 'hello', note: null }
    seedHighlights([highlight])
    const onMarkClick = vi.fn()
    render(
      <ReaderStateProvider sessionId={sessionId}>
        <HighlightedText sid={0} bid={0} text="hello world" onMarkClick={onMarkClick} />
      </ReaderStateProvider>,
    )
    const mark = document.querySelector('mark')!
    fireEvent.click(mark)
    expect(onMarkClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'h1' }))
  })
})
