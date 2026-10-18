import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SelectionToolbar } from '@/features/annotations'
import { BlockRenderer } from '@/features/reader'
import { ReaderStateProvider, useReaderState } from '@/features/reader-state'
import { useShortcuts } from '@/features/shortcuts'

const sessionId = 'sess-toolbar-test'

function Probe() {
  const { highlights } = useReaderState()
  return <div data-testid="probe">{JSON.stringify(highlights)}</div>
}

function NextDecision({ onNext }: { onNext: () => void }) {
  useShortcuts({ nextDecision: onNext })
  return null
}

function renderToolbar(props: React.ComponentProps<typeof SelectionToolbar> = {}, extra: React.ReactNode = null) {
  document.body.innerHTML = ''
  const container = document.createElement('div')
  document.body.appendChild(container)
  return render(
    <ReaderStateProvider sessionId={sessionId}>
      <Probe />
      <p data-hl data-sid="2" data-bid="1">
        Hello world
      </p>
      <p>Not selectable</p>
      <SelectionToolbar {...props} />
      {extra}
    </ReaderStateProvider>,
    { container },
  )
}

function fakeRect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    left: 100,
    right: 150,
    top: 200,
    bottom: 220,
    width: 50,
    height: 20,
    x: 100,
    y: 200,
    toJSON: () => ({}),
    ...overrides,
  } as DOMRect
}

function selectWithin(el: Element, textNodeIndex = 0, start = 0, end = 5, text = 'Hello', rect?: DOMRect) {
  const textNode = el.childNodes[textNodeIndex]!
  const range = {
    startContainer: textNode,
    startOffset: start,
    endContainer: textNode,
    endOffset: end,
    getBoundingClientRect: () => rect ?? fakeRect(),
  } as unknown as Range
  const sel = {
    isCollapsed: false,
    toString: () => text,
    getRangeAt: () => range,
    removeAllRanges: () => {},
  } as unknown as Selection
  vi.spyOn(window, 'getSelection').mockReturnValue(sel)
  fireEvent.mouseUp(document)
}

/** A selection dragged out of one leaf and into another. */
function selectAcross(fromEl: Element, toEl: Element, text = 'Hello Not') {
  const range = {
    startContainer: fromEl.childNodes[0]!,
    startOffset: 0,
    endContainer: toEl.childNodes[0]!,
    endOffset: 3,
    getBoundingClientRect: () => fakeRect(),
  } as unknown as Range
  const sel = {
    isCollapsed: false,
    toString: () => text,
    getRangeAt: () => range,
    removeAllRanges: () => {},
  } as unknown as Selection
  vi.spyOn(window, 'getSelection').mockReturnValue(sel)
  fireEvent.mouseUp(document)
}

function collapsedSelection() {
  const sel = {
    isCollapsed: true,
    toString: () => '',
    getRangeAt: () => {
      throw new Error('should not be called on a collapsed selection')
    },
    removeAllRanges: () => {},
  } as unknown as Selection
  vi.spyOn(window, 'getSelection').mockReturnValue(sel)
  fireEvent.mouseUp(document)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('SelectionToolbar', () => {
  it('stays hidden until a selection is made', () => {
    renderToolbar()
    expect(screen.queryByRole('button', { name: 'Highlight' })).not.toBeInTheDocument()
  })

  it('shows the toolbar when the selection lands inside a [data-hl] block', () => {
    renderToolbar()
    const block = screen.getByText('Hello world')
    selectWithin(block)
    expect(screen.getByRole('button', { name: 'Highlight' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Note' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ask' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })

  it('refuses a selection that spans two leaves instead of silently truncating it', () => {
    // This used to corrupt in silence: the offset walk fell through and returned
    // the first block's full text length, so the stored anchor covered text the
    // reader never selected. An anchor addresses ONE leaf; spanning two has no
    // honest answer, so there is nothing to offer.
    const { container } = render(
      <ReaderStateProvider sessionId={sessionId}>
        <p data-hl data-sid="2" data-bid="1" data-path="text">
          Hello world
        </p>
        <p data-hl data-sid="2" data-bid="2" data-path="text">
          Second para
        </p>
        <SelectionToolbar />
      </ReaderStateProvider>,
    )
    const [first, second] = Array.from(container.querySelectorAll('p'))
    selectAcross(first!, second!)

    expect(screen.queryByRole('button', { name: 'Highlight' })).not.toBeInTheDocument()
  })

  it('stays hidden when the selection is outside any [data-hl] block', () => {
    renderToolbar()
    const other = screen.getByText('Not selectable')
    selectWithin(other)
    expect(screen.queryByRole('button', { name: 'Highlight' })).not.toBeInTheDocument()
  })

  it('stays hidden for a collapsed selection', () => {
    renderToolbar()
    collapsedSelection()
    expect(screen.queryByRole('button', { name: 'Highlight' })).not.toBeInTheDocument()
  })

  it('annotates a details-nested paragraph, addressing it by leaf path', () => {
    // Nested content used to be excluded: an anchor was only (sid, bid,
    // offsets), and a nested paragraph has no top-level block index of its own,
    // so a defaulted index would have aliased another block's highlights. A leaf
    // path removes that constraint -- the nested paragraph is `blocks.0.text`
    // inside the details block's own bid.
    render(
      <ReaderStateProvider sessionId={sessionId}>
        <BlockRenderer
          sid={2}
          bid={1}
          block={{
            type: 'details',
            summary: 'more',
            blocks: [{ type: 'p', text: 'nested selectable text' }],
          }}
        />
        <SelectionToolbar />
      </ReaderStateProvider>,
    )
    const nested = screen.getByText('nested selectable text')
    expect(nested.closest('[data-hl]')).toHaveAttribute('data-path', 'blocks.0.text')

    selectWithin(nested)
    expect(screen.getByRole('button', { name: 'Highlight' })).toBeInTheDocument()
  })

  it('stays hidden when the selection is inside a block with no annotatable leaf', () => {
    // The code body used to be leafless until shiki resolved; its lines are now
    // leaves from the first paint. The card's kind tag is still plain chrome.
    render(
      <ReaderStateProvider sessionId={sessionId}>
        <BlockRenderer
          sid={2}
          bid={1}
          block={{ type: 'code', language: 'ts', code: 'const x = 1' }}
        />
        <SelectionToolbar />
      </ReaderStateProvider>,
    )
    const chrome = screen.getByText('code')
    selectWithin(chrome)
    expect(screen.queryByRole('button', { name: 'Highlight' })).not.toBeInTheDocument()
  })

  it('Highlight adds a highlight to the store with the correct offsets and clears selection', () => {
    renderToolbar()
    const block = screen.getByText('Hello world')
    selectWithin(block, 0, 0, 5, 'Hello')
    fireEvent.click(screen.getByRole('button', { name: 'Highlight' }))

    const probe = JSON.parse(screen.getByTestId('probe').textContent ?? '[]')
    expect(probe).toHaveLength(1)
    expect(probe[0]).toMatchObject({ sid: 2, bid: 1, start: 0, end: 5, text: 'Hello', note: null })
    expect(screen.queryByRole('button', { name: 'Highlight' })).not.toBeInTheDocument()
  })

  it('Note adds a highlight with an empty note and fires onRequestNote', () => {
    const onRequestNote = vi.fn()
    renderToolbar({ onRequestNote })
    const block = screen.getByText('Hello world')
    selectWithin(block, 0, 6, 11, 'world')
    fireEvent.click(screen.getByRole('button', { name: 'Note' }))

    const probe = JSON.parse(screen.getByTestId('probe').textContent ?? '[]')
    expect(probe[0]).toMatchObject({ start: 6, end: 11, note: '' })
    expect(onRequestNote).toHaveBeenCalledWith(probe[0].id)
  })

  it('Ask adds a highlight with an empty question and fires onRequestAsk', () => {
    const onRequestAsk = vi.fn()
    renderToolbar({ onRequestAsk })
    const block = screen.getByText('Hello world')
    selectWithin(block, 0, 0, 5, 'Hello')
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))

    const probe = JSON.parse(screen.getByTestId('probe').textContent ?? '[]')
    expect(probe[0]).toMatchObject({ start: 0, end: 5, question: '' })
    expect(onRequestAsk).toHaveBeenCalledWith(probe[0].id)
  })

  it('Copy invokes the copyText prop with the selected text and hides the toolbar without adding a highlight', () => {
    const copyText = vi.fn()
    renderToolbar({ copyText })
    const block = screen.getByText('Hello world')
    selectWithin(block, 0, 0, 5, 'Hello')
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))

    expect(copyText).toHaveBeenCalledWith('Hello')
    const probe = JSON.parse(screen.getByTestId('probe').textContent ?? '[]')
    expect(probe).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()
  })

  it('Escape hides the toolbar', () => {
    renderToolbar()
    const block = screen.getByText('Hello world')
    selectWithin(block)
    expect(screen.getByRole('button', { name: 'Highlight' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('button', { name: 'Highlight' })).not.toBeInTheDocument()
  })

  it('buttons preventDefault on mousedown so the browser selection survives the click', () => {
    renderToolbar()
    const block = screen.getByText('Hello world')
    selectWithin(block)
    const button = screen.getByRole('button', { name: 'Highlight' })
    const event = fireEvent.mouseDown(button)
    // fireEvent returns false when preventDefault() was called on a cancelable event
    expect(event).toBe(false)
  })

  it('applies the 44px touch floor class below the 880px breakpoint', () => {
    renderToolbar()
    const block = screen.getByText('Hello world')
    selectWithin(block)
    const button = screen.getByRole('button', { name: 'Highlight' })
    expect(button).toHaveClass('max-[880px]:min-h-11')
  })
})

describe('SelectionToolbar keys (components.md:88-90)', () => {
  function shortcutTook(key: string) {
    return !fireEvent.keyDown(document.activeElement ?? document.body, { key })
  }
  const highlights = () => JSON.parse(screen.getByTestId('probe').textContent ?? '[]') as Array<Record<string, unknown>>

  it('shows H, N and A on the toolbar as the board draws them', () => {
    renderToolbar()
    selectWithin(screen.getByText('Hello world'))

    expect(screen.getByRole('button', { name: 'Highlight' })).toHaveTextContent('HighlightH')
    expect(screen.getByRole('button', { name: 'Note' })).toHaveTextContent('NoteN')
    expect(screen.getByRole('button', { name: 'Ask' })).toHaveTextContent('AskA')
    expect(screen.getByRole('button', { name: 'Note' })).toHaveAttribute('aria-keyshortcuts', 'N')
  })

  it('N with a selection opens the note on it and does not move to a decision', () => {
    const onRequestNote = vi.fn()
    const onNext = vi.fn()
    renderToolbar({ onRequestNote }, <NextDecision onNext={onNext} />)
    selectWithin(screen.getByText('Hello world'))

    expect(shortcutTook('n')).toBe(true)

    expect(onNext).not.toHaveBeenCalled()
    expect(highlights()).toMatchObject([{ sid: 2, bid: 1, start: 0, end: 5, text: 'Hello', note: '' }])
    expect(onRequestNote).toHaveBeenCalledWith(highlights()[0]!.id)
    expect(screen.queryByRole('button', { name: 'Note' })).not.toBeInTheDocument()
  })

  it('N without a selection moves to the next unanswered decision', () => {
    const onRequestNote = vi.fn()
    const onNext = vi.fn()
    renderToolbar({ onRequestNote }, <NextDecision onNext={onNext} />)

    expect(shortcutTook('n')).toBe(true)

    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onRequestNote).not.toHaveBeenCalled()
    expect(highlights()).toEqual([])
  })

  it('H highlights the selection and A asks about it', () => {
    const onRequestAsk = vi.fn()
    renderToolbar({ onRequestAsk })
    const leaf = screen.getByText('Hello world')

    selectWithin(leaf)
    expect(shortcutTook('h')).toBe(true)
    expect(highlights()).toMatchObject([{ text: 'Hello', note: null }])
    expect(highlights()[0]).not.toHaveProperty('question')

    selectWithin(leaf, 0, 6, 11, 'world')
    expect(shortcutTook('A')).toBe(true)
    expect(highlights()[1]).toMatchObject({ text: 'world', question: '' })
    expect(onRequestAsk).toHaveBeenCalledWith(highlights()[1]!.id)
  })

  it.each([
    ['a text field', <input key="field" aria-label="target" />],
    ['a button in a popover', <div key="popover" data-popover=""><button aria-label="target" /></div>],
  ])('H, N and A do nothing while focus is in %s', (_where, extra) => {
    const onRequestNote = vi.fn()
    const onRequestAsk = vi.fn()
    const onNext = vi.fn()
    renderToolbar({ onRequestNote, onRequestAsk }, [extra, <NextDecision key="next" onNext={onNext} />])
    selectWithin(screen.getByText('Hello world'))
    screen.getByLabelText('target').focus()

    expect([shortcutTook('h'), shortcutTook('n'), shortcutTook('a')]).toEqual([false, false, false])
    expect(highlights()).toEqual([])
    expect(onRequestNote).not.toHaveBeenCalled()
    expect(onRequestAsk).not.toHaveBeenCalled()
    expect(onNext).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Highlight' })).toBeInTheDocument()
  })

  it('H, N and A do nothing while focus is on a toolbar button', () => {
    const onRequestNote = vi.fn()
    renderToolbar({ onRequestNote })
    selectWithin(screen.getByText('Hello world'))
    screen.getByRole('button', { name: 'Ask' }).focus()

    expect([shortcutTook('h'), shortcutTook('n'), shortcutTook('a')]).toEqual([false, false, false])
    expect(highlights()).toEqual([])
    expect(onRequestNote).not.toHaveBeenCalled()
  })
})
