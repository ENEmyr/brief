import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
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
} from '@/features/export'
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

const emptyState: ReaderState = { highlights: [], dsel: {}, dnote: {} }

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

function ExportProbe() {
  const { copy, toast } = useExport()
  return (
    <div>
      <button onClick={() => copy('some text')}>do-copy</button>
      <button onClick={() => toast('Custom message')}>do-toast</button>
    </div>
  )
}

describe('ExportProvider', () => {
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
})

describe('ShareModal', () => {
  it('renders the share URL, session and version chips, and copies via onCopy', () => {
    const onClose = vi.fn()
    const onCopy = vi.fn()
    render(<ShareModal sessionId="sess-abc" version="1.2.0" onClose={onClose} onCopy={onCopy} />)

    const url = `${window.location.origin}/s/sess-abc`
    expect(screen.getByRole('dialog', { name: 'Share this doc' })).toBeInTheDocument()
    expect(screen.getByText(url)).toBeInTheDocument()
    expect(screen.getByText('session sess-abc')).toBeInTheDocument()
    expect(screen.getByText('1.2.0')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(onCopy).toHaveBeenCalledWith(url)
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

  it('omits the version chip when the payload has no version', () => {
    render(<ShareModal sessionId="sess-abc" onClose={vi.fn()} onCopy={vi.fn()} />)
    expect(screen.getByText('session sess-abc')).toBeInTheDocument()
    expect(screen.queryByText(/^\d+\.\d+/)).not.toBeInTheDocument()
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

  it('Done closes the modal', () => {
    const onClose = vi.fn()
    render(<CopyFallbackModal text="copy me" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)
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

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy' })))
    expect(screen.getByRole('dialog', { name: 'Copy manually' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Share this doc' })).toBeInTheDocument()

    // First Escape: only the fallback modal (topmost) closes.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Copy manually' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Share this doc' })).toBeInTheDocument()

    // Second Escape: now the share modal closes.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Share this doc' })).not.toBeInTheDocument()
  })
})

describe('Topbar export buttons', () => {
  it('does not render Markdown/Share buttons when no handlers are provided', () => {
    render(<Topbar sessionId="sess1" />)
    expect(screen.queryByRole('button', { name: 'Download markdown' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
  })

  it('renders Markdown/Share buttons and fires their handlers when provided', () => {
    const onDownload = vi.fn()
    const onShare = vi.fn()
    render(<Topbar sessionId="sess1" onDownload={onDownload} onShare={onShare} />)

    fireEvent.click(screen.getByRole('button', { name: 'Download markdown' }))
    expect(onDownload).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    expect(onShare).toHaveBeenCalledTimes(1)
  })

  it('still renders the Print button regardless of the new handlers', () => {
    render(<Topbar sessionId="sess1" onDownload={vi.fn()} onShare={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Print / PDF' })).toBeInTheDocument()
  })
})
