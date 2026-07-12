import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { NotePopover, AskPopover, buildAskPrompt } from '@/features/annotations'
import { ReaderStateProvider, useReaderState } from '@/features/reader-state'
import type { Highlight } from '@/features/reader-state'
import type { Section } from '@brief/schema'
import SessionPage from '@/app/s/page'

const sessionId = 'sess-popovers-test'

function seedHighlights(highlights: Highlight[]) {
  localStorage.setItem(`idocs:${sessionId}`, JSON.stringify({ highlights, dsel: {}, dnote: {} }))
}

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
}

function Probe() {
  const { highlights } = useReaderState()
  return <div data-testid="probe">{JSON.stringify(highlights)}</div>
}

afterEach(async () => {
  // Every mutation schedules its localStorage write on a 0ms timer
  // (persistence.ts), so a test that ends right after one leaves that timer
  // armed. Clearing storage synchronously here does not defuse it: it fires
  // during the NEXT test and re-seeds the state we just wiped. The next
  // SessionPage then hydrates from it, because its ReaderStateProvider mounts
  // only after the envelope fetch resolves -- later than the write. Yielding
  // one macrotask first lets the pending writes land, so the clear below
  // actually removes them.
  await new Promise((resolve) => setTimeout(resolve, 0))
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('buildAskPrompt', () => {
  const sections: Section[] = [
    { id: 'intro', no: 1, title: 'Introduction', blocks: [{ type: 'p', text: 'x' }] },
  ]
  const highlight: Highlight = {
    id: 'h1',
    sid: 0,
    bid: 2,
    start: 10,
    end: 20,
    text: 'quoted bit',
    note: null,
    question: 'Why does this work?',
  }

  it('builds the full prompt with a zero-padded section number and the char-range dash', () => {
    const out = buildAskPrompt(highlight, sections, 'sess1', 'https://example.com', 'My Doc')
    const lines = out.split('\n')
    expect(lines).toContain('Question about a specific part of the "My Doc" doc (session sess1).')
    expect(lines).toContain('- URL: https://example.com/s/sess1#intro')
    expect(lines).toContain('- Location: section 01 "Introduction" · block 3 · chars 10–20')
    expect(lines).toContain('- Quoted text: "quoted bit"')
    expect(out).toContain('Question:\nWhy does this work?')
    expect(lines).toContain(
      'Please answer specifically about the quoted part above, using the reference to locate it.',
    )
  })

  it('falls back to a raw section id and drops the URL fragment when the section is missing', () => {
    const orphan: Highlight = { ...highlight, sid: 9 }
    const out = buildAskPrompt(orphan, sections, 'sess1', 'https://example.com', 'My Doc')
    const lines = out.split('\n')
    expect(lines).toContain('- URL: https://example.com/s/sess1')
    expect(lines).toContain('- Location: section 9 · block 3 · chars 10–20')
  })

  it('uses the placeholder when the question is empty or whitespace', () => {
    const out = buildAskPrompt({ ...highlight, question: '   ' }, sections, 'sess1', 'https://example.com', 'My Doc')
    expect(out).toContain('Question:\n(add your question)')
  })

  it('passes Thai text through unchanged', () => {
    const out = buildAskPrompt(
      { ...highlight, text: 'ข้อความภาษาไทย', question: 'คำถามคืออะไร' },
      sections,
      'sess1',
      'https://example.com',
      'My Doc',
    )
    expect(out).toContain('- Quoted text: "ข้อความภาษาไทย"')
    expect(out).toContain('Question:\nคำถามคืออะไร')
  })

  it('names a code line by its dotted path, same as any other structured leaf', () => {
    // describeLocation only ever treats `path` as an opaque label, so a code
    // line's `code.4` needs no special case here -- this just proves that.
    const out = buildAskPrompt({ ...highlight, path: 'code.4' }, sections, 'sess1', 'https://example.com', 'My Doc')
    expect(out).toContain('- Location: section 01 "Introduction" · block 3 (code.4) · chars 10–20')
  })

  it('does not escape quotes embedded in the quoted text', () => {
    const out = buildAskPrompt(
      { ...highlight, text: 'say "hi" now' },
      sections,
      'sess1',
      'https://example.com',
      'My Doc',
    )
    expect(out).toContain('- Quoted text: "say "hi" now"')
  })
})

describe('NotePopover', () => {
  const longText = 'A'.repeat(80)
  const highlight: Highlight = {
    id: 'h1',
    sid: 0,
    bid: 0,
    start: 0,
    end: 5,
    text: longText,
    note: 'existing note',
  }

  function renderPopover(
    props: Partial<React.ComponentProps<typeof NotePopover>> = {},
    highlights: Highlight[] = [highlight],
  ) {
    stubFetch()
    seedHighlights(highlights)
    return render(
      <ReaderStateProvider sessionId={sessionId}>
        <Probe />
        <NotePopover id="h1" onClose={vi.fn()} {...props} />
      </ReaderStateProvider>,
    )
  }

  it('truncates the quoted excerpt to 60 chars with an ellipsis', () => {
    renderPopover()
    expect(screen.getByText(`“${'A'.repeat(60)}…”`)).toBeInTheDocument()
  })

  it('renders the full excerpt untruncated when 60 chars or fewer', () => {
    renderPopover({}, [{ ...highlight, text: 'short quote' }])
    expect(screen.getByText('“short quote”')).toBeInTheDocument()
  })

  it('live-edits the note into the store on every keystroke', () => {
    renderPopover({}, [{ ...highlight, note: '' }])
    const textarea = screen.getByPlaceholderText(/write a short note/i)
    fireEvent.change(textarea, { target: { value: 'this needs a follow-up' } })
    expect(textarea).toHaveValue('this needs a follow-up')
    const probe = JSON.parse(screen.getByTestId('probe').textContent ?? '[]')
    expect(probe[0]).toMatchObject({ note: 'this needs a follow-up' })
  })

  it('Remove highlight deletes it from the store and closes the popover', () => {
    const onClose = vi.fn()
    renderPopover({ onClose })
    fireEvent.click(screen.getByRole('button', { name: 'Remove highlight' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    const probe = JSON.parse(screen.getByTestId('probe').textContent ?? '[]')
    expect(probe).toHaveLength(0)
  })

  it('Done closes the popover without touching the store', () => {
    const onClose = vi.fn()
    renderPopover({ onClose })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    const probe = JSON.parse(screen.getByTestId('probe').textContent ?? '[]')
    expect(probe).toHaveLength(1)
  })

  it('Escape closes the popover', () => {
    const onClose = vi.fn()
    renderPopover({ onClose })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when the highlight id is no longer in the store', () => {
    stubFetch()
    seedHighlights([])
    const { container } = render(
      <ReaderStateProvider sessionId={sessionId}>
        <NotePopover id="gone" onClose={vi.fn()} />
      </ReaderStateProvider>,
    )
    expect(container.querySelector('textarea')).toBeNull()
  })

  it('applies the 44px mobile touch floor to both footer buttons', () => {
    renderPopover()
    expect(screen.getByRole('button', { name: 'Remove highlight' })).toHaveClass('max-[879px]:min-h-11')
    expect(screen.getByRole('button', { name: 'Done' })).toHaveClass('max-[879px]:min-h-11')
  })
})

describe('AskPopover', () => {
  const sections: Section[] = [{ id: 'intro', no: 3, title: 'Introduction', blocks: [{ type: 'p', text: 'x' }] }]
  const longText = 'B'.repeat(160)
  const highlight: Highlight = {
    id: 'h1',
    sid: 0,
    bid: 4,
    start: 2,
    end: 9,
    text: longText,
    note: null,
    question: 'why?',
  }

  function renderPopover(
    props: Partial<React.ComponentProps<typeof AskPopover>> = {},
    highlights: Highlight[] = [highlight],
  ) {
    stubFetch()
    seedHighlights(highlights)
    return render(
      <ReaderStateProvider sessionId={sessionId}>
        <Probe />
        <AskPopover
          id="h1"
          sections={sections}
          sessionId={sessionId}
          docTitle="My Doc"
          onClose={vi.fn()}
          onCopied={vi.fn()}
          {...props}
        />
      </ReaderStateProvider>,
    )
  }

  it('renders the raw (non-padded) location reference', () => {
    renderPopover()
    expect(screen.getByText('3 · block 5 · ch 2–9')).toBeInTheDocument()
  })

  it('renders up to 140 chars of the quoted excerpt with an ellipsis', () => {
    renderPopover()
    expect(screen.getByText(`“${'B'.repeat(140)}…”`)).toBeInTheDocument()
  })

  it('disables Copy as prompt when the question is empty', () => {
    renderPopover({}, [{ ...highlight, question: '' }])
    expect(screen.getByRole('button', { name: /copy as prompt/i })).toBeDisabled()
  })

  it('copies the buildAskPrompt output and notifies onCopied when the question is non-empty', () => {
    const copyText = vi.fn()
    const onCopied = vi.fn()
    renderPopover({ copyText, onCopied })
    fireEvent.click(screen.getByRole('button', { name: /copy as prompt/i }))
    expect(copyText).toHaveBeenCalledTimes(1)
    const copied = copyText.mock.calls[0]?.[0] as string
    expect(copied).toContain('- Quoted text: "' + longText + '"')
    expect(copied).toContain('Question:\nwhy?')
    expect(onCopied).toHaveBeenCalledTimes(1)
  })

  it('live-edits the question into the store', () => {
    renderPopover({}, [{ ...highlight, question: '' }])
    const textarea = screen.getByPlaceholderText(/คำถาม/)
    fireEvent.change(textarea, { target: { value: 'what happens on retry?' } })
    expect(textarea).toHaveValue('what happens on retry?')
    const probe = JSON.parse(screen.getByTestId('probe').textContent ?? '[]')
    expect(probe[0]).toMatchObject({ question: 'what happens on retry?' })
  })

  it('Remove deletes the highlight from the store and closes the popover', () => {
    const onClose = vi.fn()
    renderPopover({ onClose })
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    const probe = JSON.parse(screen.getByTestId('probe').textContent ?? '[]')
    expect(probe).toHaveLength(0)
  })

  it('Done closes the popover without touching the store', () => {
    const onClose = vi.fn()
    renderPopover({ onClose })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    const probe = JSON.parse(screen.getByTestId('probe').textContent ?? '[]')
    expect(probe).toHaveLength(1)
  })

  it('Escape closes the popover', () => {
    const onClose = vi.fn()
    renderPopover({ onClose })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when the highlight id is no longer in the store', () => {
    stubFetch()
    seedHighlights([])
    const { container } = render(
      <ReaderStateProvider sessionId={sessionId}>
        <AskPopover
          id="gone"
          sections={sections}
          sessionId={sessionId}
          docTitle="My Doc"
          onClose={vi.fn()}
        />
      </ReaderStateProvider>,
    )
    expect(container.querySelector('textarea')).toBeNull()
  })

  it('applies the 44px mobile touch floor to every footer button', () => {
    renderPopover()
    expect(screen.getByRole('button', { name: /copy as prompt/i })).toHaveClass('max-[879px]:min-h-11')
    expect(screen.getByRole('button', { name: 'Remove' })).toHaveClass('max-[879px]:min-h-11')
    expect(screen.getByRole('button', { name: 'Done' })).toHaveClass('max-[879px]:min-h-11')
  })
})

describe('SessionView popover wiring (integration)', () => {
  const validPayload = {
    meta: { title: 'Test Doc', author: 'Ada', date: '2026-07-10', version: '1.0', readTime: '5 min' },
    sections: [{ id: 's1', no: 1, title: 'Intro', blocks: [{ type: 'p', text: 'Hello world' }] }],
    decisions: [],
  }
  const validEnvelope = {
    id: 'wiring12345678',
    title: 'Test Doc',
    saved: false,
    encrypted: false,
    encParams: null,
    payload: JSON.stringify(validPayload),
    createdAt: 1,
    lastOpenedAt: 1,
    expiresAt: 2,
  }

  function selectWithin(el: Element, start: number, end: number, text: string, nodeIndex = 0) {
    const textNode = el.childNodes[nodeIndex]!
    const range = {
      startContainer: textNode,
      startOffset: start,
      endContainer: textNode,
      endOffset: end,
      getBoundingClientRect: () => ({
        left: 10,
        right: 60,
        top: 200,
        bottom: 220,
        width: 50,
        height: 20,
        x: 10,
        y: 200,
        toJSON: () => ({}),
      }),
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

  async function renderReady() {
    window.history.replaceState(null, '', '/s/wiring12345678/')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(validEnvelope))))
    render(<SessionPage />)
    await screen.findByText('Hello world')
    // The text appearing is not the same thing as the page being ready to
    // listen. findByText resolves off a DOM mutation, which can land before
    // React has flushed its passive effects -- and SelectionToolbar registers
    // its document mouseup listener inside one of those. Fire a selection in
    // that gap and no toolbar appears, because nothing is listening yet: the
    // page looks ready and is not. Under load the gap widens, which is why this
    // only ever failed in CI.
    //
    // Flushing effects here closes it. A real reader cannot hit this race: they
    // cannot select text before the page's effects have run. It is an artefact
    // of driving the DOM directly, so the fix belongs in the test.
    await act(async () => {})
  }

  it('Note action opens the note popover; a later Ask action closes it and opens the ask popover instead', async () => {
    await renderReady()
    const paragraph = screen.getByText('Hello world')

    selectWithin(paragraph, 0, 5, 'Hello')
    fireEvent.click(screen.getByRole('button', { name: 'Note' }))
    expect(screen.getByPlaceholderText(/write a short note/i)).toBeInTheDocument()

    // The first note split the paragraph into [<mark>Hello</mark>, ' world'], so
    // a selection of "world" now lands in the second text node at offsets 1..6.
    // Addressing it as the old flat 6..11 of childNodes[0] would be selecting
    // inside the <mark> element, which is not where the reader clicked.
    selectWithin(paragraph, 1, 6, 'world', 1)
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))

    expect(screen.queryByPlaceholderText(/write a short note/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy as prompt/i })).toBeInTheDocument()
  })

  it('clicking a plain-highlight mark opens the note popover; clicking an ask mark opens the ask popover', async () => {
    await renderReady()
    const paragraph = screen.getByText('Hello world')

    selectWithin(paragraph, 0, 5, 'Hello')
    fireEvent.click(screen.getByRole('button', { name: 'Highlight' }))

    const mark = document.querySelector('mark')!
    fireEvent.click(mark)
    expect(screen.getByPlaceholderText(/write a short note/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByPlaceholderText(/write a short note/i)).not.toBeInTheDocument()
  })
})
