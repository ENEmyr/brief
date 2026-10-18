import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, render } from '@testing-library/react'
import type { Payload } from '@brief/schema'
import { Annotatable } from '@/features/annotations'
import { buildGlossaryIndex, compileNeedles, findTermHits, GlossaryProvider, PrintTerms } from '@/features/glossary'
import { ReaderStateProvider } from '@/features/reader-state'
import type { Highlight } from '@/features/reader-state'

const glossary: NonNullable<Payload['glossary']> = [
  { term: 'token bucket', def: 'A bucket refilled at a fixed rate.', aliases: ['bucket'] },
  { term: 'p95', def: 'The 95th percentile.' },
  { term: 'Retry-After', def: 'Seconds to wait before retrying.' },
]

const payload: Pick<Payload, 'glossary' | 'sections' | 'decisions'> = {
  glossary,
  sections: [
    {
      id: 'why',
      no: 1,
      title: 'Why',
      blocks: [
        { type: 'p', text: 'At p95 the token bucket wins. A token bucket again, and the bucket.' },
        { type: 'note', title: 'Use `p95` here', text: 'Answer with Retry-After.' },
      ],
    },
    {
      id: 'how',
      no: 2,
      title: 'How',
      blocks: [{ type: 'details', summary: 'More', blocks: [{ type: 'p', text: 'Each Token Bucket is per key.' }] }],
    },
  ],
  decisions: [
    { id: 'D1', q: 'Send Retry-After on 429?', multi: false, opts: [{ id: 'a', label: 'Yes' }, { id: 'b', label: 'No' }] },
  ],
}

const words = (src: string) => findTermHits(src, compileNeedles(glossary)).map((h) => src.slice(h.start, h.end))

describe('glossary matching', () => {
  it('matches whole words, case-insensitive, aliases included, longest first', () => {
    expect(words('The Token Bucket and a bucket, not buckets or tokenbucket.')).toEqual(['Token Bucket', 'bucket'])
  })

  it('never matches inside a code span or across a run edge', () => {
    expect(words('run `p95` then **p95** and *token* bucket')).toEqual(['p95', 'bucket'])
  })

  it('treats letters of unspaced scripts as word edges', () => {
    expect(words('ระบบใช้token bucketแทน')).toEqual(['token bucket'])
    expect(words('xp95 p95x p95.')).toEqual(['p95'])
  })

  it('underlines the first use of each term per section only, in render order', () => {
    const index = buildGlossaryIndex(payload)
    expect([...index.leaves.entries()]).toEqual([
      ['0|0|text', [
        { start: 3, end: 6, n: 2 },
        { start: 11, end: 23, n: 1 },
      ]],
      ['0|1|title', []],
      ['0|1|text', [{ start: 12, end: 23, n: 3 }]],
      ['1|0|blocks.0.text', [{ start: 5, end: 17, n: 1 }]],
    ].filter(([, hits]) => (hits as unknown[]).length > 0))
  })

  it('also finds terms in table cells and stat labels', () => {
    const index = buildGlossaryIndex({
      glossary,
      decisions: [],
      sections: [
        {
          id: 's',
          no: 1,
          title: 'S',
          blocks: [
            { type: 'table', head: ['Metric', 'p95'], rows: [['a', 'the token bucket']] },
            { type: 'stat', items: [{ label: 'Retry-After sent', value: '3' }] },
          ],
        },
      ],
    })
    expect([...index.leaves.entries()]).toEqual([
      ['0|0|head.1', [{ start: 0, end: 3, n: 2 }]],
      ['0|0|rows.0.1', [{ start: 4, end: 16, n: 1 }]],
      ['0|1|items.0.label', [{ start: 0, end: 11, n: 3 }]],
    ])
  })

  it('lists the sections and decisions that use each term', () => {
    const { terms } = buildGlossaryIndex(payload)
    expect(terms.map((t) => [t.n, t.term, t.sections.map((s) => s.no), t.decisions])).toEqual([
      [1, 'token bucket', [1, 2], []],
      [2, 'p95', [1], []],
      [3, 'Retry-After', [1], ['D1']],
    ])
  })

  it('is empty without a glossary', () => {
    expect(buildGlossaryIndex({ ...payload, glossary: undefined }).leaves.size).toBe(0)
  })
})

const sessionId = 'sess-glossary'

function renderLeaf(highlights: Highlight[] = [], handlers = { onSection: vi.fn(), onDecision: vi.fn() }) {
  localStorage.setItem(`idocs:${sessionId}`, JSON.stringify({ highlights, dsel: {}, dnote: {} }))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
  const text = payload.sections[0]!.blocks[0]!.type === 'p' ? (payload.sections[0]!.blocks[0] as { text: string }).text : ''
  const utils = render(
    <ReaderStateProvider sessionId={sessionId}>
      <GlossaryProvider payload={payload} {...handlers}>
        <Annotatable as="p" text={text} sid={0} bid={0} path="text" markdown />
        <PrintTerms glossary={glossary} />
      </GlossaryProvider>
    </ReaderStateProvider>,
  )
  return { ...utils, leaf: utils.container.querySelector('p') as HTMLParagraphElement, text, handlers }
}

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('glossary terms in a leaf', () => {
  it('wraps only the first uses and keeps the leaf text exact', () => {
    const { leaf, text } = renderLeaf()
    expect(leaf.textContent).toBe(text)
    expect([...leaf.querySelectorAll('[data-term]')].map((el) => [el.textContent, el.getAttribute('data-term')])).toEqual([
      ['p95', '2'],
      ['token bucket', '1'],
    ])
  })

  it('fades the popover in over 120 ms, and not at all under reduced motion (B-NewBlocks:28,30)', () => {
    const { leaf } = renderLeaf()
    act(() => leaf.querySelector<HTMLElement>('[data-term="1"]')!.focus())
    const tip = document.querySelector<HTMLElement>('[data-glossary-tip="1"]')!
    expect(tip.className).toContain('animate-[console-in_120ms_ease_both]')
    expect(tip.className).toContain('motion-reduce:animate-none')
  })

  it('splits a highlight that crosses a term edge and keeps one note marker', () => {
    const h: Highlight = {
      id: 'h1', sid: 0, bid: 0, path: 'text', start: 7, end: 17, text: 'the token ', note: 'n', createdAt: 0,
    } as Highlight
    const { leaf, text } = renderLeaf([h])
    expect(leaf.textContent).toBe(text)
    const marks = [...leaf.querySelectorAll('mark[data-mark-id="h1"]')]
    expect(marks.map((m) => m.textContent).join('')).toBe('the token ')
    expect(marks.filter((m) => m.getAttribute('data-marker') === 'note')).toHaveLength(1)
  })

  it('opens on focus with the definition and its uses, and Escape returns focus', () => {
    const { leaf, handlers } = renderLeaf()
    const term = leaf.querySelector<HTMLElement>('[data-term="1"]')!
    act(() => term.focus())
    const tip = document.querySelector<HTMLElement>('[data-glossary-tip="1"]')!
    expect(tip.textContent).toBe('token bucket§01§02A bucket refilled at a fixed rate.')
    const links = [...tip.querySelectorAll('button')]
    fireEvent.keyDown(term, { key: 'Tab' })
    expect(document.activeElement).toBe(links[0])
    fireEvent.keyDown(links[0]!, { key: 'Escape' })
    expect(document.querySelector('[data-glossary-tip]')).toBeNull()
    expect(document.activeElement).toBe(term)
    fireEvent.click(term)
    fireEvent.click(document.querySelector<HTMLElement>('[data-glossary-tip="1"] button:nth-child(2)')!)
    expect(handlers.onSection).toHaveBeenCalledWith('how')
  })

  it('toggles on tap and stays open on a mouse click', () => {
    const { leaf } = renderLeaf()
    const term = leaf.querySelector<HTMLElement>('[data-term="2"]')!
    // jsdom has no PointerEvent, so pointerType is set by hand.
    const press = (pointerType: string) => {
      const ev = new MouseEvent('pointerdown', { bubbles: true })
      Object.defineProperty(ev, 'pointerType', { value: pointerType })
      act(() => void term.dispatchEvent(ev))
      fireEvent.click(term)
    }
    const tap = () => press('touch')
    tap()
    expect(document.querySelector('[data-glossary-tip="2"]')).not.toBeNull()
    tap()
    expect(document.querySelector('[data-glossary-tip="2"]')).toBeNull()
    press('mouse')
    press('mouse')
    expect(document.querySelector('[data-glossary-tip="2"]')).not.toBeNull()
  })

  it('prints the numbered Terms list in glossary order', () => {
    const { container } = renderLeaf()
    const dts = [...container.querySelectorAll('[data-print-terms] dt')].map((d) => d.textContent)
    expect(dts).toEqual(['1 token bucket', '2 p95', '3 Retry-After'])
  })
})
