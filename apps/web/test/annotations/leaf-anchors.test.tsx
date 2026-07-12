import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Block } from '@brief/schema'
import { BlockRenderer } from '@/features/reader'
import { SectionView } from '@/features/reader/components/SectionView'
import { ReaderStateProvider } from '@/features/reader-state'
import type { Highlight } from '@/features/reader-state'
import { coerceState } from '@/features/reader-state/coerce'

const sessionId = 'leaf-anchor-test'

function renderBlock(block: Block, highlights: Highlight[] = []) {
  if (highlights.length) {
    localStorage.setItem(`idocs:${sessionId}`, JSON.stringify({ highlights, dsel: {}, dnote: {} }))
  }
  return render(
    <ReaderStateProvider sessionId={sessionId}>
      <BlockRenderer block={block} sid={0} bid={1} />
    </ReaderStateProvider>,
  )
}

const anchorOf = (el: HTMLElement) => el.closest('[data-hl]')

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
})
afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('leaf anchors', () => {
  it('makes every table cell annotatable, addressed by its position', () => {
    renderBlock({
      type: 'table',
      caption: 'Costs',
      head: ['Item', 'Price'],
      rows: [['Widget', '10']],
    })

    expect(anchorOf(screen.getByText('Costs'))).toHaveAttribute('data-path', 'caption')
    expect(anchorOf(screen.getByText('Price'))).toHaveAttribute('data-path', 'head.1')
    expect(anchorOf(screen.getByText('Widget'))).toHaveAttribute('data-path', 'rows.0.0')
    expect(anchorOf(screen.getByText('10'))).toHaveAttribute('data-path', 'rows.0.1')
  })

  it('anchors a callout title and body separately', () => {
    // They must be separate leaves: the callout's flattened DOM text is
    // title + text, so one whole-block anchor would slice the model's `text`
    // field at offsets measured across both and land title.length characters off.
    renderBlock({ type: 'note', title: 'Heads up', text: 'The body' })

    expect(anchorOf(screen.getByText('Heads up'))).toHaveAttribute('data-path', 'title')
    expect(anchorOf(screen.getByText('The body'))).toHaveAttribute('data-path', 'text')
  })

  it('makes stat cards and coverage rows annotatable', () => {
    renderBlock({ type: 'stat', items: [{ value: '4300', label: 'Employees', hint: 'approx' }] })
    expect(anchorOf(screen.getByText('Employees'))).toHaveAttribute('data-path', 'items.0.label')
    expect(anchorOf(screen.getByText('approx'))).toHaveAttribute('data-path', 'items.0.hint')
  })

  it('anchors a section heading at bid null, since a heading is not a block', () => {
    render(
      <ReaderStateProvider sessionId={sessionId}>
        <SectionView
          sid={3}
          section={{ id: 's1', no: 1, title: 'Overview', blocks: [] }}
        />
      </ReaderStateProvider>,
    )

    const anchor = anchorOf(screen.getByText('Overview'))
    expect(anchor).toHaveAttribute('data-path', 'title')
    expect(anchor).toHaveAttribute('data-sid', '3')
    // Absent, not "-1": a sentinel index would collide with a real block.
    expect(anchor).not.toHaveAttribute('data-bid')
  })

  it('paints a highlight into the leaf it was anchored to', () => {
    renderBlock({ type: 'table', head: ['Item'], rows: [['Widget']] }, [
      {
        id: 'h1',
        sid: 0,
        bid: 1,
        path: 'rows.0.0',
        start: 0,
        end: 6,
        text: 'Widget',
        note: null,
      },
    ])

    expect(screen.getByText('Widget').tagName).toBe('MARK')
  })

  it('does not leak a highlight from one leaf into another with the same offsets', () => {
    renderBlock({ type: 'table', head: ['Widget'], rows: [['Widget']] }, [
      {
        id: 'h1',
        sid: 0,
        bid: 1,
        path: 'rows.0.0',
        start: 0,
        end: 6,
        text: 'Widget',
        note: null,
      },
    ])

    // Identical text and offsets in head.0, but the anchor names rows.0.0.
    const marks = screen.getAllByText('Widget').filter((el) => el.tagName === 'MARK')
    expect(marks).toHaveLength(1)
    expect(anchorOf(marks[0]!)).toHaveAttribute('data-path', 'rows.0.0')
  })

  it('drops a highlight whose stored text no longer matches its offsets', () => {
    // The payload was edited under the anchor. Painting it anyway would
    // highlight characters the reader never selected.
    renderBlock({ type: 'p', text: 'Completely different prose now' }, [
      { id: 'h1', sid: 0, bid: 1, path: 'text', start: 0, end: 5, text: 'Hello', note: null },
    ])

    expect(document.querySelector('mark')).toBeNull()
  })

  it('treats a legacy highlight with no path as a paragraph body', () => {
    // Highlights written before paths existed can only be paragraphs: `p` was
    // the only annotatable block, and its one string field is `text`.
    const legacy = { id: 'h1', sid: 0, bid: 1, start: 0, end: 5, text: 'Hello', note: null }
    renderBlock({ type: 'p', text: 'Hello world' }, [legacy as Highlight])

    expect(screen.getByText('Hello').tagName).toBe('MARK')
  })
})

describe('coerceState', () => {
  it('keeps a valid highlight and drops malformed ones', () => {
    const state = coerceState({
      highlights: [
        { id: 'ok', sid: 0, bid: 1, path: 'text', start: 0, end: 5, text: 'Hello', note: null },
        { id: 'heading', sid: 0, bid: null, path: 'title', start: 0, end: 2, text: 'Hi', note: null },
        { id: 'no-sid', bid: 1, start: 0, end: 5, text: 'x', note: null },
        { id: 'bad-range', sid: 0, bid: 1, start: 9, end: 2, text: 'x', note: null },
        'not an object',
      ],
      dsel: {},
      dnote: {},
    })

    expect(state.highlights.map((h) => h.id)).toEqual(['ok', 'heading'])
  })

  it('normalizes a legacy path-less highlight without inventing a path', () => {
    const state = coerceState({
      highlights: [{ id: 'legacy', sid: 0, bid: 1, start: 0, end: 5, text: 'Hello', note: null }],
    })

    expect(state.highlights[0]).toEqual({
      id: 'legacy',
      sid: 0,
      bid: 1,
      start: 0,
      end: 5,
      text: 'Hello',
      note: null,
    })
  })

  it('survives a non-array highlights field', () => {
    expect(coerceState({ highlights: 'nope' }).highlights).toEqual([])
  })
})
