import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import type { Payload } from '@brief/schema'
import type { Highlight, ReaderState } from '@/features/reader-state'
import { ReaderStateProvider } from '@/features/reader-state'
import {
  buildExportMarkdown,
  copyText,
  downloadMarkdown,
  ExportProvider,
  useExport,
  ShareModal,
  CopyFallbackModal,
  printDocument,
} from '@/features/export'
import { useTheme, beginThemedRender } from '@/features/theme'
import { endAnimation } from '../shared/endAnimation'
import { Topbar } from '@/features/reader/components/Topbar'

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))
}

function stubClipboard(execCommandResult: boolean, clipboard?: { writeText: (t: string) => Promise<void> } | null) {
  document.execCommand = vi.fn().mockReturnValue(execCommandResult)
  Object.defineProperty(navigator, 'clipboard', { value: clipboard ?? undefined, configurable: true })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
  localStorage.clear()
})

const basePayload: Payload = {
  meta: { title: 'Rate Limiter', version: '1.2.0' },
  sections: [{ id: 's1', no: 1, title: 'Intro', blocks: [{ type: 'p', text: 'Hello' }] }],
  decisions: [
    {
      id: 'd1',
      q: 'Which cache backend?',
      multi: false,
      opts: [
        { id: 'kv', label: 'Cloudflare KV' },
        { id: 'none', label: 'No cache' },
      ],
    },
    {
      id: 'd2',
      q: 'Which limiter strategies apply?',
      multi: true,
      opts: [
        { id: 'token', label: 'Token bucket' },
        { id: 'sliding', label: 'Sliding window' },
      ],
    },
  ],
}

const emptyState: ReaderState = { highlights: [], dsel: {}, dnote: {}, dother: {} }

describe('buildExportMarkdown', () => {
  it('renders (no highlights) when there are none', () => {
    const md = buildExportMarkdown(basePayload, emptyState, 'sess1', 'https://example.com')
    expect(md).toContain('## Reader highlights & notes\n\n_(no highlights)_')
  })

  it('numbers highlights with quoted text and note/question sublines', () => {
    const highlights: Highlight[] = [
      { id: 'h1', sid: 0, bid: 0, start: 0, end: 5, text: 'Hello', note: 'Check this', question: undefined },
      { id: 'h2', sid: 0, bid: 0, start: 0, end: 5, text: 'World', note: null, question: 'Why though?' },
      { id: 'h3', sid: 0, bid: 0, start: 0, end: 5, text: 'Plain', note: null },
    ]
    const md = buildExportMarkdown(basePayload, { ...emptyState, highlights }, 'sess1', 'https://example.com')

    expect(md).toContain('1. Highlighted: “Hello”')
    expect(md).toContain('   - Reader note: Check this')
    expect(md).toContain('2. Highlighted: “World”')
    expect(md).toContain('   - Reader question: Why though?')
    expect(md).toContain('3. Highlighted: “Plain”')
    // Highlight 3 has no note/question, so it must not gain either subline.
    const lines = md.split('\n')
    const h3Index = lines.indexOf('3. Highlighted: “Plain”')
    expect(lines[h3Index + 1]).not.toMatch(/Reader note|Reader question/)
  })

  it('resolves decision checkboxes from dsel option ids, not option order', () => {
    const state: ReaderState = {
      ...emptyState,
      dsel: { d1: ['none'], d2: ['token', 'sliding'] },
      dnote: { d1: 'thought about it' },
    }
    const md = buildExportMarkdown(basePayload, state, 'sess1', 'https://example.com')

    expect(md).toContain('### [d1] Which cache backend?')
    expect(md).toContain('- [ ] Cloudflare KV')
    expect(md).toContain('- [x] No cache')
    expect(md).toContain('- **Answer:** No cache')
    expect(md).toContain('- **Free-text note:** thought about it')

    expect(md).toContain('### [d2] Which limiter strategies apply? _(multi-select)_')
    expect(md).toContain('- [x] Token bucket')
    expect(md).toContain('- [x] Sliding window')
    expect(md).toContain('- **Answer:** Token bucket; Sliding window')
  })

  it('prints the reader Other answer as a ticked line and in the answer, single and multi', () => {
    const state: ReaderState = {
      ...emptyState,
      dsel: { d2: ['token'] },
      dother: { d1: '  Durable Object  ', d2: 'leaky bucket' },
    }
    const md = buildExportMarkdown(basePayload, state, 'sess1', 'https://example.com')

    expect(md).toContain('- [ ] Cloudflare KV\n- [ ] No cache\n- [x] Other: Durable Object\n')
    expect(md).toContain('- **Answer:** Other: Durable Object')
    expect(md).toContain('- [x] Other: leaky bucket')
    expect(md).toContain('- **Answer:** Token bucket; Other: leaky bucket')
  })

  it('lists no Other line when the reader did not pick Other', () => {
    const md = buildExportMarkdown(basePayload, { ...emptyState, dsel: { d1: ['kv'] } }, 'sess1', 'https://example.com')
    expect(md).not.toContain('Other')
  })

  it('renders (not answered) and (none) empty states for an unanswered decision', () => {
    const md = buildExportMarkdown(basePayload, emptyState, 'sess1', 'https://example.com')

    expect(md).toContain('- [ ] Cloudflare KV')
    expect(md).toContain('- [ ] No cache')
    expect(md).toContain('- **Answer:** _(not answered)_')
    expect(md).toContain('- **Free-text note:** _(none)_')
  })

  it('appends the exported-from footer with the share URL', () => {
    const md = buildExportMarkdown(basePayload, emptyState, 'sess1', 'https://example.com')
    expect(md).toContain('_Exported from Brief · https://example.com/s/sess1_')
  })

  it('skips the appended Decisions section entirely when the payload has no decisions', () => {
    const noDecisions: Payload = { ...basePayload, decisions: [] }
    const md = buildExportMarkdown(noDecisions, emptyState, 'sess1', 'https://example.com')
    // Neither payloadToMarkdown's own Decisions section nor the appended
    // reader-answers one should leave a dangling heading.
    expect(md).not.toContain('## Decisions')
    expect(md).toContain('## Reader highlights & notes')
    expect(md).toContain('_Exported from Brief · https://example.com/s/sess1_')
  })

  it('still includes the full document body via payloadToMarkdown', () => {
    const md = buildExportMarkdown(basePayload, emptyState, 'sess1', 'https://example.com')
    expect(md).toContain('# Rate Limiter')
    expect(md).toContain('## 1. Intro')
    expect(md).toContain('Hello')
  })
})

describe('downloadMarkdown', () => {
  it('creates a text/markdown blob, names the file brief-<sessionId>.md, clicks the anchor, and defers URL revocation by 500ms', () => {
    vi.useFakeTimers()
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    const revokeObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const appendSpy = vi.spyOn(document.body, 'appendChild')

    downloadMarkdown(basePayload, emptyState, 'sess1', 'https://example.com')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blobArg = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(blobArg.type).toBe('text/markdown;charset=utf-8')

    const anchor = appendSpy.mock.calls.find((call) => call[0] instanceof HTMLAnchorElement)?.[0] as HTMLAnchorElement
    expect(anchor.download).toBe('brief-sess1.md')
    expect(anchor.href).toBe('blob:mock-url')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(499))
    expect(revokeObjectURL).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')

    clickSpy.mockRestore()
    appendSpy.mockRestore()
  })
})

describe('copyText chain', () => {
  it('resolves "copied" via execCommand and never touches the async Clipboard API', async () => {
    const writeText = vi.fn()
    stubClipboard(true, { writeText })

    const result = await copyText('hello')

    expect(result).toBe('copied')
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('falls back to the async Clipboard API when execCommand fails, resolving "copied"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(false, { writeText })

    const result = await copyText('hello')

    expect(result).toBe('copied')
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('resolves "fallback" when both execCommand and the Clipboard API fail', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    stubClipboard(false, { writeText })

    const result = await copyText('hello')

    expect(result).toBe('fallback')
  })

  it('resolves "fallback" when execCommand fails and no Clipboard API exists', async () => {
    stubClipboard(false, null)

    const result = await copyText('hello')

    expect(result).toBe('fallback')
  })
})

function ExportProbe({ retry = () => {} }: { retry?: () => void }) {
  const { copy, toast, print, copyEditPrompt, share } = useExport()
  return (
    <div>
      <button onClick={share}>do-share</button>
      <button onClick={() => copy('some text')}>do-copy</button>
      <button onClick={() => toast({ kind: 'info', message: 'Custom message' })}>do-toast</button>
      <button onClick={() => toast({ kind: 'error', message: 'It broke', action: { label: 'Retry', run: retry } })}>
        do-error
      </button>
      <button onClick={() => toast({ kind: 'error', message: 'Already protected' })}>do-final-error</button>
      <button onClick={print}>do-print</button>
      <button onClick={copyEditPrompt}>do-copy-edit-prompt</button>
    </div>
  )
}

function seedReaderState(sessionId: string, state: Partial<ReaderState>) {
  localStorage.setItem(
    `idocs:${sessionId}`,
    JSON.stringify({ highlights: [], dsel: {}, dnote: {}, ...state }),
  )
}

describe('ExportProvider', () => {
  it('print() calls window.print()', () => {
    stubFetch()
    const print = vi.fn()
    vi.stubGlobal('print', print)
    render(
      <ReaderStateProvider sessionId="sess-print">
        <ExportProvider sessionId="sess-print" payload={basePayload}>
          <ExportProbe />
        </ExportProvider>
      </ReaderStateProvider>,
    )

    fireEvent.click(screen.getByText('do-print'))

    expect(print).toHaveBeenCalledTimes(1)
  })

  it('toast auto-dismisses 1600ms after being shown', () => {
    vi.useFakeTimers()
    stubFetch()
    render(
      <ReaderStateProvider sessionId="sess-toast">
        <ExportProvider sessionId="sess-toast" payload={basePayload}>
          <ExportProbe />
        </ExportProvider>
      </ReaderStateProvider>,
    )

    act(() => fireEvent.click(screen.getByText('do-toast')))
    expect(screen.getByRole('status')).toHaveTextContent('Custom message')

    act(() => vi.advanceTimersByTime(1599))
    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  // B-States:155: only an error toast with an action stays; one without leaves after 1.6s like any other.
  it('an error toast with no action is an alert that leaves after 1.6s and has no Dismiss', () => {
    vi.useFakeTimers()
    stubFetch()
    render(
      <ReaderStateProvider sessionId="sess-toast-final">
        <ExportProvider sessionId="sess-toast-final" payload={basePayload}>
          <ExportProbe />
        </ExportProvider>
      </ReaderStateProvider>,
    )

    act(() => fireEvent.click(screen.getByText('do-final-error')))
    expect(screen.getByRole('alert')).toHaveTextContent('Already protected')
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1599))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('an error toast with an action is an alert that stays until acted on or dismissed, one toast at a time', () => {
    vi.useFakeTimers()
    stubFetch()
    const retry = vi.fn()
    render(
      <ReaderStateProvider sessionId="sess-toast-error">
        <ExportProvider sessionId="sess-toast-error" payload={basePayload}>
          <ExportProbe retry={retry} />
        </ExportProvider>
      </ReaderStateProvider>,
    )

    act(() => fireEvent.click(screen.getByText('do-error')))
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.getByRole('alert')).toHaveTextContent('It broke')

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Retry' })))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    act(() => fireEvent.click(screen.getByText('do-error')))
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Dismiss' })))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(retry).toHaveBeenCalledTimes(1)

    act(() => fireEvent.click(screen.getByText('do-error')))
    act(() => fireEvent.click(screen.getByText('do-toast')))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Custom message')
  })

  it('copy() shows a "Copied" toast on success', async () => {
    stubFetch()
    stubClipboard(true, { writeText: vi.fn() })
    render(
      <ReaderStateProvider sessionId="sess-copy">
        <ExportProvider sessionId="sess-copy" payload={basePayload}>
          <ExportProbe />
        </ExportProvider>
      </ReaderStateProvider>,
    )

    await act(async () => fireEvent.click(screen.getByText('do-copy')))

    expect(screen.getByRole('status')).toHaveTextContent('Copied')
  })

  it('copy() opens the CopyFallbackModal with the failed text when both copy paths fail', async () => {
    stubFetch()
    stubClipboard(false, null)
    render(
      <ReaderStateProvider sessionId="sess-fallback">
        <ExportProvider sessionId="sess-fallback" payload={basePayload}>
          <ExportProbe />
        </ExportProvider>
      </ReaderStateProvider>,
    )

    await act(async () => fireEvent.click(screen.getByText('do-copy')))

    expect(screen.getByRole('dialog', { name: 'Copy manually' })).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('some text')
  })

  it('the share dialog fades out inert, then unmounts and hands focus back; a reopen mid-exit works', async () => {
    stubFetch()
    render(
      <ReaderStateProvider sessionId="sess-exit">
        <ExportProvider sessionId="sess-exit" payload={basePayload}>
          <ExportProbe />
        </ExportProvider>
      </ReaderStateProvider>,
    )
    const trigger = screen.getByText('do-share')
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Share this doc' })

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(dialog).toBeInTheDocument()
    expect(dialog.closest('[data-overlay-exit]')).toHaveAttribute('inert')

    fireEvent.click(trigger)
    const reopened = screen.getByRole('dialog', { name: 'Share this doc' })
    expect(reopened.closest('[inert]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Copy link' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    endAnimation(reopened.parentElement!)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('copyEditPrompt() toasts instead of copying when there is nothing to act on', async () => {
    stubFetch()
    render(
      <ReaderStateProvider sessionId="sess-edit-empty">
        <ExportProvider sessionId="sess-edit-empty" payload={basePayload}>
          <ExportProbe />
        </ExportProvider>
      </ReaderStateProvider>,
    )

    await act(async () => fireEvent.click(screen.getByText('do-copy-edit-prompt')))

    expect(screen.getByRole('status')).toHaveTextContent(/no edit points yet/i)
  })

  it('copyEditPrompt() builds and copies the prompt when a decision has been answered', async () => {
    stubFetch()
    stubClipboard(true, { writeText: vi.fn() })
    seedReaderState('sess-edit-answered', { dsel: { d1: ['kv'] } })
    render(
      <ReaderStateProvider sessionId="sess-edit-answered">
        <ExportProvider sessionId="sess-edit-answered" payload={basePayload}>
          <ExportProbe />
        </ExportProvider>
      </ReaderStateProvider>,
    )

    await act(async () => fireEvent.click(screen.getByText('do-copy-edit-prompt')))

    expect(screen.getByRole('status')).toHaveTextContent('Copied')
  })

  it('copyEditPrompt() omits the raw URL and asks the reader to paste content for an encrypted session', async () => {
    stubFetch()
    // execCommandResult=false forces the copy chain past execCommandCopy so
    // the text actually reaches the mocked async Clipboard API, where this
    // test can inspect what was copied.
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(false, { writeText })
    seedReaderState('sess-edit-encrypted', { dsel: { d1: ['kv'] } })
    render(
      <ReaderStateProvider sessionId="sess-edit-encrypted">
        <ExportProvider sessionId="sess-edit-encrypted" payload={basePayload} encrypted>
          <ExportProbe />
        </ExportProvider>
      </ReaderStateProvider>,
    )

    await act(async () => fireEvent.click(screen.getByText('do-copy-edit-prompt')))

    const copied = writeText.mock.calls[0]?.[0] as string
    expect(copied).toMatch(/paste the current document/i)
    expect(copied).not.toContain('/api/session')
  })
})

describe('printDocument', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme')
  })

  it('calls window.print() immediately, without forcing a theme override, when the app is not on dark', async () => {
    document.documentElement.setAttribute('data-theme', 'light')
    const print = vi.fn()
    vi.stubGlobal('print', print)

    await printDocument()

    expect(print).toHaveBeenCalledTimes(1)
  })

  it('forces light, waits for in-flight chart/diagram renders, prints, then restores dark (blocker 2)', async () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    const print = vi.fn()
    vi.stubGlobal('print', print)

    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')

    // Simulate a chart/diagram still redrawing in the new palette: print
    // must not fire until this settles.
    const endRender = beginThemedRender()
    let printing!: Promise<void>
    await act(async () => {
      printing = printDocument()
      await new Promise((resolve) => setTimeout(resolve, 60))
    })
    expect(result.current.theme).toBe('light')
    expect(print).not.toHaveBeenCalled()

    await act(async () => {
      endRender()
      await printing
    })

    expect(print).toHaveBeenCalledTimes(1)
    expect(result.current.theme).toBe('dark')
  })
})

describe('ShareModal', () => {
  // B-Overlays:41-42.
  it('shows the link without its scheme, the session, version and expiry chips, and copies the full URL', async () => {
    const onCopy = vi.fn().mockResolvedValue('copied')
    render(
      <ShareModal
        sessionId="sess-abc"
        version="1.2.0"
        expiresAt={Date.UTC(2026, 10, 13, 9, 0, 0)}
        onClose={vi.fn()}
        onCopy={onCopy}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Share this doc' })).toBeInTheDocument()
    expect(screen.getByText(`${window.location.host}/s/sess-abc`)).toBeInTheDocument()
    expect(screen.getByText('session sess-abc')).toBeInTheDocument()
    expect(screen.getByText('1.2.0')).toBeInTheDocument()
    expect(screen.getByText('expires 2026-11-13')).toBeInTheDocument()

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy link' })))
    expect(onCopy).toHaveBeenCalledWith(`${window.location.origin}/s/sess-abc`)
  })

  it('takes focus on Copy link, copies on Enter, and reads "Copied" for 1.5s after a copy that worked', async () => {
    vi.useFakeTimers()
    const onCopy = vi.fn().mockResolvedValue('copied')
    render(<ShareModal sessionId="sess-abc" onClose={vi.fn()} onCopy={onCopy} />)
    const dialog = screen.getByRole('dialog', { name: 'Share this doc' })
    expect(screen.getByRole('button', { name: 'Copy link' })).toHaveFocus()

    dialog.focus()
    await act(async () => fireEvent.keyDown(dialog, { key: 'Enter' }))
    expect(onCopy).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1499))
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument()

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy link' })))
    act(() => vi.advanceTimersByTime(1000))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copied' })))
    act(() => vi.advanceTimersByTime(1499))
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument()
  })

  it('keeps "Copy link" when the copy fell back to the manual dialog, and Enter on Close does not copy', async () => {
    const onCopy = vi.fn().mockResolvedValue('fallback')
    render(<ShareModal sessionId="sess-abc" onClose={vi.fn()} onCopy={onCopy} />)

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy link' })))
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), { key: 'Enter' })
    expect(onCopy).toHaveBeenCalledTimes(1)
  })

  it('closes via the close button, Escape, and backdrop click', () => {
    const onClose = vi.fn()
    render(<ShareModal sessionId="sess-abc" onClose={onClose} onCopy={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('omits the version and expiry chips when the session has neither', () => {
    render(<ShareModal sessionId="sess-abc" onClose={vi.fn()} onCopy={vi.fn()} />)
    expect(screen.getByText('session sess-abc')).toBeInTheDocument()
    expect(screen.queryByText(/^\d+\.\d+/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^expires/)).not.toBeInTheDocument()
  })
})

describe('CopyFallbackModal', () => {
  it('renders the text pre-selected and autofocused', () => {
    render(<CopyFallbackModal text="copy me please" onClose={vi.fn()} />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea).toHaveValue('copy me please')
    expect(textarea).toHaveFocus()
  })

  it('Try copy again re-runs execCommand only, fires onCopied, and closes on success', () => {
    // Give it a working Clipboard API too, to prove the retry never touches it
    // (prototype line 335 retries the synchronous path exclusively).
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(true, { writeText })
    const onClose = vi.fn()
    const onCopied = vi.fn()
    render(<CopyFallbackModal text="copy me" onClose={onClose} onCopied={onCopied} />)

    fireEvent.click(screen.getByRole('button', { name: /Try copy again/ }))

    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(writeText).not.toHaveBeenCalled()
    expect(onCopied).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('stays open and does not fall back to the Clipboard API when execCommand fails again', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(false, { writeText })
    const onClose = vi.fn()
    const onCopied = vi.fn()
    render(<CopyFallbackModal text="copy me" onClose={onClose} onCopied={onCopied} />)

    fireEvent.click(screen.getByRole('button', { name: /Try copy again/ }))

    expect(writeText).not.toHaveBeenCalled()
    expect(onCopied).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Copy manually' })).toBeInTheDocument()
  })

  // B-Overlays:107.
  it('Close closes the modal', () => {
    const onClose = vi.fn()
    render(<CopyFallbackModal text="copy me" onClose={onClose} />)
    for (const close of screen.getAllByRole('button', { name: 'Close' })) fireEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('stacked dialogs (ShareModal + CopyFallbackModal)', () => {
  it('Escape closes only the topmost dialog, then the one underneath', async () => {
    // Both copy paths fail so ShareModal's Copy opens CopyFallbackModal on top.
    stubFetch()
    stubClipboard(false, null)

    function ShareOpener() {
      const { share } = useExport()
      return <button onClick={share}>open-share</button>
    }

    render(
      <ReaderStateProvider sessionId="sess-stack">
        <ExportProvider sessionId="sess-stack" payload={basePayload}>
          <ShareOpener />
        </ExportProvider>
      </ReaderStateProvider>,
    )

    fireEvent.click(screen.getByText('open-share'))
    expect(screen.getByRole('dialog', { name: 'Share this doc' })).toBeInTheDocument()

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy link' })))
    expect(screen.getByRole('dialog', { name: 'Copy manually' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Share this doc' })).toBeInTheDocument()

    // First Escape: only the fallback modal (topmost) closes. A closing
    // dialog stays mounted, inert, through its exit fade.
    const closing = (name: string) => screen.queryByRole('dialog', { name })?.closest('[data-overlay-exit]') ?? null
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(closing('Copy manually')).not.toBeNull()
    expect(closing('Share this doc')).toBeNull()

    // Second Escape, still inside that fade: now the share modal closes.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(closing('Share this doc')).not.toBeNull()
  })
})

describe('Topbar export controls', () => {
  it('does not render the Download menu or Share button when no handlers are provided', () => {
    render(<Topbar sessionId="sess1" />)
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
  })

  // The print control used to be hardcoded and ungated, so it rendered even on
  // the propless loading-skeleton Topbar -- offering to print a document that
  // had not loaded. It is a prop now, like every other control.
  it('does not render any print control when onPrint is not provided', () => {
    render(<Topbar sessionId="sess1" />)
    expect(screen.queryByRole('button', { name: /print/i })).not.toBeInTheDocument()

    render(<Topbar sessionId="sess1" onDownload={vi.fn()} onShare={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    expect(screen.getByRole('menuitem', { name: /Markdown/ })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Print/ })).not.toBeInTheDocument()
  })

  it('fires onShare from the Share button', () => {
    const onShare = vi.fn()
    render(<Topbar sessionId="sess1" onShare={onShare} />)

    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    expect(onShare).toHaveBeenCalledTimes(1)
  })
})

// Item labels follow the B-Components menu: "Markdown" and "PDF" (they were
// "Markdown (.md)" and "Print / PDF"); the behavior is unchanged.
describe('Topbar Download menu', () => {
  function renderMenu() {
    const onDownload = vi.fn()
    const onPrint = vi.fn()
    render(<Topbar sessionId="sess1" onDownload={onDownload} onPrint={onPrint} />)
    return { onDownload, onPrint, trigger: screen.getByRole('button', { name: 'Download' }) }
  }

  it('is closed until the trigger is clicked, then exposes both actions', () => {
    const { trigger } = renderMenu()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)

    expect(screen.getByRole('menu', { name: 'Download' })).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: /^Markdown$/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /^PDF$/ })).toBeInTheDocument()
  })

  it('Markdown fires onDownload and closes the menu', () => {
    const { onDownload, onPrint, trigger } = renderMenu()
    fireEvent.click(trigger)

    fireEvent.click(screen.getByRole('menuitem', { name: /^Markdown$/ }))

    expect(onDownload).toHaveBeenCalledTimes(1)
    expect(onPrint).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('PDF fires onPrint and closes the menu', () => {
    const { onDownload, onPrint, trigger } = renderMenu()
    fireEvent.click(trigger)

    fireEvent.click(screen.getByRole('menuitem', { name: /^PDF$/ }))

    expect(onPrint).toHaveBeenCalledTimes(1)
    expect(onDownload).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('focuses the first item on open, and Escape closes it and restores focus to the trigger', () => {
    const { trigger } = renderMenu()
    fireEvent.click(trigger)

    expect(screen.getByRole('menuitem', { name: /^Markdown$/ })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  // Regression for the click-away bug: a `position: fixed` overlay rendered
  // inside Topbar's header (which has `backdrop-blur`, making it a
  // containing block for fixed descendants) resolves `inset-0` against the
  // ~56px header box, not the viewport, so a click on the page body never
  // reached it. jsdom has no layout, so it cannot reproduce the coordinate
  // bug directly -- this instead pins the actual fix: a document-level
  // pointerdown listener with no viewport-covering element involved at all.
  it('closes on a document-level pointerdown outside the menu, wherever the target is', () => {
    const { trigger } = renderMenu()
    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.pointerDown(document.body)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('does not close on a pointerdown inside the panel (an item click still runs its own close)', () => {
    const { trigger } = renderMenu()
    fireEvent.click(trigger)

    fireEvent.pointerDown(screen.getByRole('menuitem', { name: /^Markdown$/ }))

    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('re-clicking the trigger toggles the menu closed instead of being raced by the outside-click listener', () => {
    // A real click dispatches pointerdown before click; the trigger sits
    // inside rootRef alongside the panel, so the outside-click listener
    // must treat this pointerdown as "inside" and leave closing entirely to
    // the trigger's own onClick toggle.
    const { trigger } = renderMenu()
    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('ArrowDown/ArrowUp/Home/End move focus between items with roving navigation', () => {
    const { trigger } = renderMenu()
    fireEvent.click(trigger)

    const markdownItem = screen.getByRole('menuitem', { name: /^Markdown$/ })
    const printItem = screen.getByRole('menuitem', { name: /^PDF$/ })
    expect(markdownItem).toHaveFocus()

    fireEvent.keyDown(markdownItem, { key: 'ArrowDown' })
    expect(printItem).toHaveFocus()

    fireEvent.keyDown(printItem, { key: 'ArrowDown' })
    expect(markdownItem).toHaveFocus()

    fireEvent.keyDown(markdownItem, { key: 'ArrowUp' })
    expect(printItem).toHaveFocus()

    fireEvent.keyDown(printItem, { key: 'End' })
    expect(printItem).toHaveFocus()

    fireEvent.keyDown(printItem, { key: 'Home' })
    expect(markdownItem).toHaveFocus()
  })
})
