import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { Annotatable, selectionRangeIn } from '@/features/annotations'
import { parseInline, visibleSlice } from '@/features/annotations/lib/inlineMarkdown'
import { ReaderStateProvider } from '@/features/reader-state'
import type { Highlight } from '@/features/reader-state'

const sessionId = 'sess-inline-md'

function renderLeaf(text: string, highlights: Highlight[] = []) {
  localStorage.setItem(`idocs:${sessionId}`, JSON.stringify({ highlights, dsel: {}, dnote: {} }))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
  const { container } = render(
    <ReaderStateProvider sessionId={sessionId}>
      <Annotatable as="p" text={text} sid={0} bid={0} path="text" markdown />
    </ReaderStateProvider>,
  )
  return container.querySelector('p') as HTMLParagraphElement
}

/** Visible text: the leaf's text with hidden marker spans left out. */
function visible(el: Element): string {
  const clone = el.cloneNode(true) as Element
  clone.querySelectorAll('[hidden]').forEach((n) => n.remove())
  return clone.textContent ?? ''
}

function shape(src: string) {
  return parseInline(src).map((r) => [r.kind, src.slice(r.start + r.marker, r.end - r.marker)])
}

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('parseInline', () => {
  it('splits code, strong and em runs and tiles the source', () => {
    const src = 'run `npm ci` then **ship** it *now*'
    expect(shape(src)).toEqual([
      ['plain', 'run '],
      ['code', 'npm ci'],
      ['plain', ' then '],
      ['strong', 'ship'],
      ['plain', ' it '],
      ['em', 'now'],
    ])
    expect(
      parseInline(src)
        .map((r) => src.slice(r.start, r.end))
        .join(''),
    ).toBe(src)
  })

  it.each([
    ['unmatched backtick', 'a `b c'],
    ['empty code', 'a `` b'],
    ['unmatched bold', 'a **b c'],
    ['arithmetic stars', '2 * 3 * 4'],
    ['spaced bold', 'a ** b ** c'],
    ['four stars', '****'],
    ['lone star', '*'],
  ])('renders %s literally', (_, src) => {
    expect(shape(src)).toEqual([['plain', src]])
  })

  it('keeps markers inside a run literal instead of nesting', () => {
    expect(shape('**a `b` *c* d**')).toEqual([['strong', 'a `b` *c* d']])
    expect(shape('`a **b** c`')).toEqual([['code', 'a **b** c']])
    expect(shape('*a **b** c*')).toEqual([['em', 'a **b** c']])
  })
})

describe('visibleSlice', () => {
  it('drops the markers inside the range only', () => {
    const src = 'run `npm ci` then **ship**'
    expect(visibleSlice(src, 0, src.length)).toBe('run npm ci then ship')
    expect(visibleSlice(src, 2, 8)).toBe('n npm')
    expect(visibleSlice('a `b c', 0, 6)).toBe('a `b c')
  })
})

describe('Annotatable with markdown', () => {
  it('renders runs as code, strong and em while textContent stays the source', () => {
    const src = 'run `npm ci` then **ship** it *now*'
    const p = renderLeaf(src)
    expect(p.querySelector('code')?.textContent).toBe('`npm ci`')
    expect(p.querySelector('strong')?.textContent).toBe('**ship**')
    expect(p.querySelector('em')?.textContent).toBe('*now*')
    expect(p.textContent).toBe(src)
    expect(visible(p)).toBe('run npm ci then ship it now')
    expect(p.hasAttribute('data-md')).toBe(true)
  })

  it('renders an XSS string through every marker as text, never as HTML', () => {
    const xss = '<img src=x onerror=alert(1)><script>alert(2)</script>'
    const src = `${xss} \`${xss}\` **${xss}** *${xss}* \`${xss} **${xss}*`
    const p = renderLeaf(src)
    expect(p.querySelector('img, script')).toBeNull()
    const tags = new Set([...p.querySelectorAll('*')].map((el) => el.tagName))
    expect([...tags].sort()).toEqual(['CODE', 'EM', 'SPAN', 'STRONG'])
    expect(p.textContent).toBe(src)
  })

  it('still draws a highlight stored before markdown rendered, on text with backticks', () => {
    // Before this change the leaf showed its source, so the stored anchor
    // counts the backticks: "`npm ci`" is source offsets 4..12.
    const src = 'run `npm ci` now'
    const p = renderLeaf(src, [
      {
        id: 'old',
        sid: 0,
        bid: 0,
        path: 'text',
        start: 4,
        end: 12,
        text: '`npm ci`',
        note: 'why ci',
      },
    ])
    const marks = p.querySelectorAll('mark')
    expect(marks).toHaveLength(1)
    expect(marks[0]?.textContent).toBe('npm ci')
    expect(marks[0]?.closest('code')).not.toBeNull()
    expect(marks[0]?.getAttribute('data-marker')).toBe('note')
  })

  it('draws a highlight across a bold run as one mark per run, marker on the last', () => {
    const src = 'we **ship it** today'
    // "ship it** tod": starts inside the bold run, ends in the plain tail.
    const p = renderLeaf(src, [
      {
        id: 'h1',
        sid: 0,
        bid: 0,
        path: 'text',
        start: 5,
        end: 18,
        text: 'ship it** tod',
        note: 'n',
      },
    ])
    const marks = [...p.querySelectorAll('mark')]
    expect(marks.map((m) => m.textContent)).toEqual(['ship it', ' tod'])
    expect(marks[0]?.closest('strong')).not.toBeNull()
    expect(marks.map((m) => m.getAttribute('data-marker'))).toEqual([null, 'note'])
    expect(p.textContent).toBe(src)
  })

  it('gives each character to one mark when highlights overlap, as code lines do', () => {
    const src = 'abc `defg` hij'
    const p = renderLeaf(src, [
      { id: 'first', sid: 0, bid: 0, path: 'text', start: 0, end: 7, text: 'abc `de', note: null },
      {
        id: 'second',
        sid: 0,
        bid: 0,
        path: 'text',
        start: 5,
        end: 12,
        text: 'defg` h',
        note: null,
      },
    ])
    expect(p.textContent).toBe(src)
    const marks = [...p.querySelectorAll('mark')]
    expect(marks.map((m) => [m.dataset.markId, m.textContent])).toEqual([
      ['first', 'abc '],
      ['first', 'de'],
      ['second', 'fg'],
      ['second', ' h'],
    ])
  })

  it('measures a selection inside a code span in source offsets', () => {
    const src = 'run `npm ci` now'
    const p = renderLeaf(src)
    const codeText = p.querySelector('code')?.childNodes[1] as Text
    expect(codeText.textContent).toBe('npm ci')
    const range = document.createRange()
    range.setStart(codeText, 0)
    range.setEnd(codeText, 3)
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)
    expect(selectionRangeIn(p, sel)).toEqual({ start: 5, end: 8, text: 'npm' })
  })
})
