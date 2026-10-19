import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import SessionPage from '@/app/s/page'
import { encryptPayloadWithKey, newSessionKey } from '@/features/save/lib/crypto'
import { endAnimation } from '../shared/endAnimation'

const validPayload = {
  meta: {
    title: 'Test Doc',
    author: 'Ada',
    date: '2026-07-10',
    version: '1.0',
    repo: 'https://github.com/example/repo',
    readTime: '5 min',
  },
  sections: [{ id: 's1', no: 1, title: 'Intro', blocks: [{ type: 'p', text: 'Hello world' }] }],
  decisions: [],
}

const validEnvelope = {
  id: 'abc12345678901',
  title: 'Test Doc',
  saved: false,
  encrypted: false,
  encParams: null,
  payload: JSON.stringify(validPayload),
  createdAt: 1,
  lastOpenedAt: 1,
  expiresAt: 2,
}

// PBKDF2 at the real 600,000 iterations takes seconds on a loaded machine, past
// waitFor's 1 s default. These tests cover the unlock flow, crypto.test.ts covers
// the real count, and encrypt and decrypt both derive through this spy.
beforeEach(() => {
  const deriveKey = crypto.subtle.deriveKey.bind(crypto.subtle)
  vi.spyOn(crypto.subtle, 'deriveKey').mockImplementation((algorithm, ...rest) =>
    deriveKey({ ...(algorithm as Pbkdf2Params), iterations: 1_000 }, ...rest),
  )
})

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  // Reader state is keyed by session id and these tests share one, so a test
  // that seeds or writes an entry must not leak it into the next. Doing this
  // in afterEach rather than at the end of a test body means a failing test
  // cleans up too. A click at the end of a test schedules a 0 ms persist
  // write, so let it land first, or it writes the entry back after the clear.
  await new Promise((resolve) => setTimeout(resolve, 0))
  window.localStorage.clear()
})

// The doc title now also appears in the top bar (B-Reader), so the loaded
// reader is identified by its h1 rather than by the title text alone.
describe('SessionPage / SessionView', () => {
  it('renders skeleton first, then title, section heading and paragraph after resolve', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(validEnvelope))))

    render(<SessionPage />)

    expect(screen.queryByRole('heading', { level: 1, name: 'Test Doc' })).not.toBeInTheDocument()

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Test Doc' })).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: /Intro/ })).toBeInTheDocument()
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('shows not-found message on 404', async () => {
    window.history.replaceState(null, '', '/s/missing12345678/')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"error":"x"}', { status: 404 })),
    )

    render(<SessionPage />)

    await waitFor(() =>
      expect(screen.getByText(/Session not found or expired/i)).toBeInTheDocument(),
    )
  })

  // B-States:48-51.
  it('a missing session shows its id and a link home', async () => {
    window.history.replaceState(null, '', '/s/missing1234567/')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"x"}', { status: 404 })))

    render(<SessionPage />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Session not found or expired.' })).toBeInTheDocument()
    expect(screen.getByText('404 / missing1234567')).toBeInTheDocument()
    expect(screen.getByText('Check the link, or ask the agent to publish the brief again.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to brief home' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  })

  it('a link with no valid session id shows 404 without an id', async () => {
    window.history.replaceState(null, '', '/s/short/')
    vi.stubGlobal('fetch', vi.fn())

    render(<SessionPage />)

    expect(await screen.findByText('404')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Session not found or expired.' })).toBeInTheDocument()
  })

  it('a failed load is an alert with Retry and the reassurance line', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })))

    render(<SessionPage />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('load failed')
    expect(within(alert).getByRole('heading', { level: 1, name: 'Something went wrong loading this session.' })).toBeInTheDocument()
    expect(alert).toHaveTextContent('Your answers saved on this device are safe.')
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('a protected session with no unlock parameters is an alert with no action', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    const corrupt = { ...validEnvelope, encrypted: true, encParams: null, payload: 'cipher' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(corrupt))))

    render(<SessionPage />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('protected')
    expect(within(alert).getByRole('heading', { level: 1, name: 'Protected session data is corrupted.' })).toBeInTheDocument()
    expect(alert).toHaveTextContent('The encrypted copy is missing what it needs to unlock. Ask the agent to publish it again.')
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument()
  })

  // B-States:115-119.
  it('a brief with no decisions shows the empty dock note and no dock', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(validEnvelope))))

    render(<SessionPage />)

    expect(
      await screen.findByText((_, el) =>
        el?.tagName === 'P' &&
        el.textContent ===
          'This brief asks nothing. Read it, highlight what matters, then copy your notes back with Edit > Copy edit prompt.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Decision dock' })).not.toBeInTheDocument()
  })

  // The decisions moved from the end of the document into the decision dock,
  // and the outline lists only payload sections (B-Reader has no Decisions row).
  it('renders the Decisions section inside the decision dock, with no outline entry for it', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    const withDecisions = {
      ...validPayload,
      decisions: [
        {
          id: 'd1',
          q: 'Which cache?',
          multi: false,
          opts: [{ id: 'kv', label: 'KV' }, { id: 'none', label: 'None' }],
        },
      ],
    }
    const envelope = { ...validEnvelope, payload: JSON.stringify(withDecisions) }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope))))

    render(<SessionPage />)

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Test Doc' })).toBeInTheDocument())
    const dock = screen.getByRole('complementary', { name: 'Decision dock' })
    expect(within(dock).getByText('DECISIONS')).toBeInTheDocument()
    expect(within(dock).getByRole('group', { name: 'Question d1' })).toBeInTheDocument()
    const outline = screen.getByRole('navigation', { name: 'Outline' })
    expect(within(outline).queryByText('Decisions')).not.toBeInTheDocument()
    expect(within(outline).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['#s1'])
  })

  it('shows the UnlockCard password form for encrypted sessions (no stub text)', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    const encEnvelope = {
      ...validEnvelope,
      encrypted: true,
      payload: 'ciphertext',
      encParams: { salt: 'a', iv: 'b', iterations: 600_000 },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(encEnvelope))))

    render(<SessionPage />)

    await waitFor(() => expect(screen.getByText('Protected session')).toBeInTheDocument())
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeInTheDocument()
    expect(screen.queryByText(/arrives in a later release/i)).not.toBeInTheDocument()
  })

  // The "protected" chip became the save chip's "this tab only" state (B-States).
  it('unlocking a protected session (real WebCrypto round trip) renders the ready view with the decrypted payload, no Archive button, and "this tab only"', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    const { ciphertext, encParams } = await encryptPayloadWithKey(JSON.stringify(validPayload), await newSessionKey('correct-horse'))
    const encEnvelope = {
      ...validEnvelope,
      encrypted: true,
      saved: true,
      payload: ciphertext,
      encParams,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(encEnvelope))))

    render(<SessionPage />)
    await waitFor(() => expect(screen.getByText('Protected session')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-horse' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Test Doc' })).toBeInTheDocument())
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByRole('status')).toHaveTextContent('this tab only')
  })

  it('unlocked protected session runs reader state memory-only: no state-endpoint calls, leftover localStorage entry removed', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    // Simulate a pre-fix visit that persisted plaintext reader state for this
    // protected session -- the unlocked view must clean it up.
    window.localStorage.setItem(
      'idocs:abc12345678901',
      JSON.stringify({ highlights: [], dsel: {}, dnote: { d1: 'plaintext note' } }),
    )
    const { ciphertext, encParams } = await encryptPayloadWithKey(JSON.stringify(validPayload), await newSessionKey('correct-horse'))
    const encEnvelope = { ...validEnvelope, encrypted: true, payload: ciphertext, encParams }
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(encEnvelope))))
    vi.stubGlobal('fetch', fetchMock)

    render(<SessionPage />)
    await waitFor(() => expect(screen.getByText('Protected session')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-horse' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Test Doc' })).toBeInTheDocument())

    // Zero-knowledge: the unauthenticated KV state endpoint must never be
    // touched for a protected session -- not even the mount-time GET.
    const stateCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/state'))
    expect(stateCalls).toHaveLength(0)
    // Pre-fix plaintext removed. The scrub runs in ReaderStateProvider's mount
    // effect, and React flushes passive effects after it commits the DOM, so
    // "Test Doc" can be on screen a tick before the entry is gone. Waiting for
    // the removal rather than asserting it outright is what keeps this green on
    // a loaded machine; a bare expect() here raced the effect and failed in CI.
    await waitFor(() => expect(window.localStorage.getItem('idocs:abc12345678901')).toBeNull())
    // ... and nothing rewrote it afterwards.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(window.localStorage.getItem('idocs:abc12345678901')).toBeNull()
  })

  it('wrong password on a protected session shows the generic error and lets the reader retry', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    const { ciphertext, encParams } = await encryptPayloadWithKey(JSON.stringify(validPayload), await newSessionKey('correct-horse'))
    const encEnvelope = { ...validEnvelope, encrypted: true, payload: ciphertext, encParams }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(encEnvelope))))

    render(<SessionPage />)
    await waitFor(() => expect(screen.getByText('Protected session')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'totally-wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

    await waitFor(() => expect(screen.getByText('Wrong password or corrupted data.')).toBeInTheDocument())
    expect(screen.queryByRole('heading', { level: 1, name: 'Test Doc' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('the archive dialog fades out inert on Escape and on Close, then unmounts and hands focus back to Archive', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(validEnvelope))))
    render(<SessionPage />)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Test Doc' })).toBeInTheDocument())
    const archive = screen.getByRole('button', { name: 'Archive' })

    for (const close of [
      () => fireEvent.keyDown(document.activeElement!, { key: 'Escape' }),
      (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole('button', { name: 'Close' })),
    ]) {
      archive.focus()
      fireEvent.click(archive)
      const dialog = screen.getByRole('dialog', { name: 'Archive this doc' })

      close(dialog)
      expect(dialog).toBeInTheDocument()
      expect(dialog.closest('[data-overlay-exit]')).toHaveAttribute('inert')
      endAnimation(dialog.parentElement!)
      expect(screen.queryByRole('dialog', { name: 'Archive this doc' })).toBeNull()
      expect(archive).toHaveFocus()
    }
  })

  // The "archived" chip is gone from the top bar (B-Reader); the Archive icon fills and reads "Archived" instead.
  it('Archive button opens SaveModal, and a plain save marks the Archive button archived without losing the doc', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(validEnvelope))))

    render(<SessionPage />)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Test Doc' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    const dialog = screen.getByRole('dialog', { name: 'Archive this doc' })

    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' })))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Archive this doc' })).not.toBeInTheDocument())
    // The doc must still be rendered -- encrypt/plain save must never blank the reader.
    expect(screen.getByRole('heading', { level: 1, name: 'Test Doc' })).toBeInTheDocument()
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archived' })).toHaveAttribute('title', 'Archived')
  })

  it('an encrypt save keeps the CURRENT decrypted payload on screen (does not drop to the protected-session card)', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(validEnvelope))))

    render(<SessionPage />)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Test Doc' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    const dialog = screen.getByRole('dialog', { name: 'Archive this doc' })
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Archive with password' }))
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Archive this doc' })).not.toBeInTheDocument(),
    )
    // Must still show the live document, never the "Protected session" placeholder.
    expect(screen.getByRole('heading', { level: 1, name: 'Test Doc' })).toBeInTheDocument()
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.queryByText(/Protected session/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archived' })).toHaveAttribute('title', 'Archived')
    // State is memory-only from here on (bug-250), and the save chip says so.
    await waitFor(() =>
      expect(within(screen.getByRole('banner')).getByRole('status')).toHaveTextContent('this tab only'),
    )
  })

  it('a highlight added after an in-view encrypt save does not resync plaintext to the state endpoint (bug-250)', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    // Seed a pre-existing localStorage entry so the post-encrypt assertion
    // below is load-bearing: without stopPersistence's clearPersistedState
    // call, this entry (or one schedulePersist rewrites) would still be
    // present after the encrypt save, and this test would fail.
    window.localStorage.setItem(
      'idocs:abc12345678901',
      JSON.stringify({ highlights: [], dsel: {}, dnote: { d1: 'pre-save note' } }),
    )
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(validEnvelope)))
    vi.stubGlobal('fetch', fetchMock)

    render(<SessionPage />)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Test Doc' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    const dialog = screen.getByRole('dialog', { name: 'Archive this doc' })
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Archive with password' }))
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Archive this doc' })).not.toBeInTheDocument(),
    )
    // The encrypt save must scrub the localStorage entry. stopPersistence
    // runs in a passive effect after the save settles (SessionView's
    // encryptedNow effect), and the save promise resolves outside act, so
    // the effect flush races a bare assertion on slow runners -- wait for
    // the scrub instead of asserting synchronously.
    await waitFor(() => expect(window.localStorage.getItem('idocs:abc12345678901')).toBeNull())

    fetchMock.mockClear()

    // Simulate selecting "Hello" inside the paragraph and clicking Highlight,
    // same technique as toolbar.test.tsx's selectWithin helper.
    const block = screen.getByText('Hello world')
    const textNode = block.childNodes[0]!
    const range = {
      startContainer: textNode,
      startOffset: 0,
      endContainer: textNode,
      endOffset: 5,
      getBoundingClientRect: () => ({
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    } as unknown as Range
    const sel = {
      isCollapsed: false,
      toString: () => 'Hello',
      getRangeAt: () => range,
      removeAllRanges: () => {},
    } as unknown as Selection
    vi.spyOn(window, 'getSelection').mockReturnValue(sel)
    fireEvent.mouseUp(document)
    fireEvent.click(screen.getByRole('button', { name: 'Highlight' }))

    // The highlight still renders -- persistence being stopped must not hide
    // annotations already made or newly added in this view.
    expect(document.querySelector('mark')).toHaveTextContent('Hello')
    // No PUT to the state endpoint was made re-persisting it, and the
    // localStorage entry an unfixed provider would have rewritten stays gone.
    expect(
      fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PUT'),
    ).toBe(false)
    expect(window.localStorage.getItem('idocs:abc12345678901')).toBeNull()

    vi.restoreAllMocks()
    window.localStorage.clear()
  })
})

describe('decision dock in the reader', () => {
  const dockPayload = {
    ...validPayload,
    decisions: [
      { id: 'd1', q: 'Which cache?', multi: false, opts: [{ id: 'kv', label: 'KV' }, { id: 'none', label: 'None' }] },
      { id: 'd2', q: 'Which regions?', multi: true, opts: [{ id: 'us', label: 'US' }, { id: 'eu', label: 'EU' }] },
      { id: 'd3', q: 'Which limit?', multi: false, opts: [{ id: '60', label: '60' }, { id: '600', label: '600' }] },
    ],
  }

  function stubApi() {
    const envelope = { ...validEnvelope, payload: JSON.stringify(dockPayload) }
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url.endsWith('/state')
            ? new Response(JSON.stringify({ state: null }))
            : new Response(JSON.stringify(envelope)),
        ),
      ),
    )
    document.execCommand = vi.fn().mockReturnValue(true)
  }

  async function openReader() {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    stubApi()
    const view = render(<SessionPage />)
    await waitFor(() => expect(screen.getByRole('group', { name: 'Question d1' })).toBeInTheDocument())
    // The reader binds its keys in a mount effect, which React can flush after the
    // dock is on screen; a key pressed before that is lost. The state GET starts in
    // a mount effect of the same commit, so once it is sent the keys are bound.
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/state$/)))
    return view
  }

  const question = (id: string) => screen.getByRole('group', { name: `Question ${id}` })

  it('the command palette fades out inert, then unmounts and hands focus back to Search', async () => {
    await openReader()
    const search = screen.getByRole('button', { name: 'Search' })
    search.focus()
    fireEvent.click(search)
    const palette = screen.getByRole('dialog', { name: 'Command palette' })

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(palette.closest('[data-overlay-exit]')).toHaveAttribute('inert')

    endAnimation(palette.parentElement!)
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull()
    expect(search).toHaveFocus()
  })

  // jsdom has no layout, so it does not implement scrollIntoView.
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })
  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView
  })

  it('Copy prompt for agent copies at once and opens the review with the same text, open questions included', async () => {
    await openReader()
    fireEvent.click(within(question('d1')).getByRole('radio', { name: 'KV' }))
    fireEvent.click(screen.getByRole('button', { name: /^Copy prompt for agent/ }))

    expect(document.execCommand).toHaveBeenCalledWith('copy')
    const review = screen.getByRole('dialog', { name: 'Review prompt before copying' })
    const text = (within(review).getByRole('textbox', { name: 'Prompt text' }) as HTMLTextAreaElement).value
    expect(text).toContain('[d1] Which cache?\n  - Choice: KV')
    expect(text).toContain('[d3] Which limit?\n  - Choice: (not answered)')
  })

  it('Go to Dn closes the review and focuses that question in the dock', async () => {
    await openReader()
    fireEvent.click(within(question('d1')).getByRole('radio', { name: 'KV' }))
    fireEvent.click(screen.getByRole('button', { name: /^Copy prompt for agent/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Go to d2' }))

    // The review fades out inert; once it unmounts, focus stays on d2 instead of going back to the trigger.
    const review = screen.getByRole('dialog', { name: 'Review prompt before copying' })
    expect(review.closest('[data-overlay-exit]')).toHaveAttribute('inert')
    endAnimation(review.parentElement!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(question('d2')).getByRole('checkbox', { name: 'US' })).toHaveFocus()
  })

  it('the review sheet fades out inert on Escape, then unmounts and hands focus back to its trigger', async () => {
    await openReader()
    const trigger = screen.getByRole('button', { name: /^Copy prompt for agent/ })
    trigger.focus()
    fireEvent.click(trigger)
    const review = screen.getByRole('dialog', { name: 'Review prompt before copying' })

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(review.closest('[data-overlay-exit]')).toHaveAttribute('inert')
    endAnimation(review.parentElement!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('the shortcut sheet fades out inert on Escape, then unmounts and hands focus back', async () => {
    await openReader()
    const search = screen.getByRole('button', { name: 'Search' })
    search.focus()
    fireEvent.keyDown(search, { key: '?' })
    const sheet = screen.getByRole('dialog', { name: 'Keyboard shortcuts' })

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(sheet.closest('[data-overlay-exit]')).toHaveAttribute('inert')
    endAnimation(sheet.parentElement!)
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull()
    expect(search).toHaveFocus()
  })

  it('N jumps to the next unanswered question, then the one after the focused question', async () => {
    await openReader()
    fireEvent.click(within(question('d1')).getByRole('radio', { name: 'KV' }))
    document.body.focus()

    fireEvent.keyDown(document.body, { key: 'n', code: 'KeyN' })
    expect(within(question('d2')).getByRole('checkbox', { name: 'US' })).toHaveFocus()

    fireEvent.keyDown(document.activeElement!, { key: 'n', code: 'KeyN' })
    expect(within(question('d3')).getByRole('radio', { name: '60' })).toHaveFocus()

    fireEvent.keyDown(document.activeElement!, { key: 'n', code: 'KeyN' })
    expect(within(question('d2')).getByRole('checkbox', { name: 'US' })).toHaveFocus()
  })

  it('N does nothing while typing a reason', async () => {
    await openReader()
    const reason = screen.getByRole('textbox', { name: 'd3 Reason' })
    reason.focus()
    fireEvent.keyDown(reason, { key: 'n', code: 'KeyN' })
    expect(reason).toHaveFocus()
  })

  it('Cmd or Ctrl Enter copies the prompt from inside the dock, not from the document', async () => {
    await openReader()
    fireEvent.keyDown(document.body, { key: 'Enter', ctrlKey: true })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const reason = screen.getByRole('textbox', { name: 'd1 Reason' })
    reason.focus()
    fireEvent.keyDown(reason, { key: 'Enter', metaKey: true })
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(screen.getByRole('dialog', { name: 'Review prompt before copying' })).toBeInTheDocument()
  })

  describe('under 880, in the dock sheet', () => {
    // Narrow for any query on the 880 breakpoint, whichever way it is written.
    beforeEach(() => {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: /\b(879|880)(\.\d+)?px/.test(query),
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }))
    })

    async function openSheet() {
      await openReader()
      fireEvent.click(screen.getByRole('button', { name: 'Open dock' }))
      return screen.getByRole('dialog', { name: 'Decision dock' })
    }

    it('Escape closes the review first, then the sheet under it', async () => {
      const sheet = await openSheet()
      fireEvent.click(within(sheet).getByRole('button', { name: 'Copy prompt for agent' }))
      expect(screen.getByRole('dialog', { name: 'Review prompt before copying' })).toBeInTheDocument()

      // The review fades out inert, so the next Escape already reaches the sheet.
      fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
      expect(screen.getByRole('dialog', { name: 'Review prompt before copying' }).closest('[data-overlay-exit]')).toHaveAttribute('inert')
      expect(screen.getByRole('dialog', { name: 'Decision dock' })).toBeInTheDocument()

      fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
      expect(screen.queryByRole('dialog', { name: 'Decision dock' })).not.toBeInTheDocument()
    })

    it('Go to Dn shows that question in the sheet and focuses it', async () => {
      const sheet = await openSheet()
      fireEvent.click(within(question('d1')).getByRole('radio', { name: 'KV' }))
      fireEvent.click(within(sheet).getByRole('button', { name: 'Copy prompt for agent' }))
      fireEvent.click(screen.getByRole('button', { name: 'Go to d2' }))

      const review = screen.getByRole('dialog', { name: 'Review prompt before copying' })
      endAnimation(review.parentElement!)
      expect(screen.queryByRole('dialog', { name: 'Review prompt before copying' })).not.toBeInTheDocument()
      expect(within(question('d2')).getByRole('checkbox', { name: 'US' })).toHaveFocus()
    })

    it('N, a number and Cmd or Ctrl Enter work inside the sheet', async () => {
      await openSheet()
      within(question('d1')).getByRole('radio', { name: 'KV' }).focus()
      fireEvent.keyDown(document.activeElement!, { key: '2', code: 'Digit2' })
      expect(within(question('d1')).getByRole('radio', { name: 'None' })).toHaveAttribute('aria-checked', 'true')

      fireEvent.keyDown(document.activeElement!, { key: 'n', code: 'KeyN' })
      expect(within(question('d2')).getByRole('checkbox', { name: 'US' })).toHaveFocus()

      fireEvent.keyDown(document.activeElement!, { key: 'Enter', ctrlKey: true })
      expect(document.execCommand).toHaveBeenCalledWith('copy')
      expect(screen.getByRole('dialog', { name: 'Review prompt before copying' })).toBeInTheDocument()
    })
  })

  it('a reload keeps an Other answer', async () => {
    const first = await openReader()
    fireEvent.click(within(question('d3')).getByRole('radio', { name: 'Other, type your own' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'd3 Your answer' }), { target: { value: '300 a minute' } })
    await waitFor(() => expect(window.localStorage.getItem('idocs:abc12345678901')).toContain('300 a minute'))
    first.unmount()

    await openReader()
    expect(screen.getByRole('textbox', { name: 'd3 Your answer' })).toHaveValue('300 a minute')
    expect(within(question('d3')).getByRole('radio', { name: 'Other, type your own' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
})

describe('outline warn dot for open decisions', () => {
  const refsPayload = {
    ...validPayload,
    sections: [
      { id: 's1', no: 1, title: 'Intro', blocks: [{ type: 'p', text: 'Hello world' }] },
      { id: 's2', no: 2, title: 'Cache', blocks: [{ type: 'p', text: 'About the cache' }] },
    ],
    decisions: [
      {
        id: 'd1',
        q: 'Which cache?',
        multi: false,
        refs: ['s2'],
        opts: [{ id: 'kv', label: 'KV' }, { id: 'none', label: 'None' }],
      },
    ],
  }

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })
  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView
  })

  it('marks the section a decision points to until the decision is answered', async () => {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    const envelope = { ...validEnvelope, payload: JSON.stringify(refsPayload) }
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url.endsWith('/state')
            ? new Response(JSON.stringify({ state: null }))
            : new Response(JSON.stringify(envelope)),
        ),
      ),
    )
    document.execCommand = vi.fn().mockReturnValue(true)
    render(<SessionPage />)
    const group = await screen.findByRole('group', { name: 'Question d1' })

    const dots = () => screen.getAllByRole('img', { name: 'open decisions' })
    expect(dots()).toHaveLength(1)
    expect(dots()[0]!.closest('a')).toHaveAttribute('href', '#s2')

    fireEvent.click(within(group).getByRole('radio', { name: 'KV' }))
    await waitFor(() => expect(screen.queryByRole('img', { name: 'open decisions' })).not.toBeInTheDocument())
  })
})

describe('outline Agent trail row', () => {
  const trajectory = {
    type: 'trajectory',
    steps: [
      { at: '2026-10-15T01:00:00Z', kind: 'request', title: 'Do not touch the webhooks' },
      { at: '2026-10-15T01:00:52Z', kind: 'decision', title: 'key = API key', flag: true },
      { at: '2026-10-15T01:02:05Z', kind: 'assumption', title: 'Webhooks use a fixed IP range', flag: true },
    ],
  }
  const withBlocks = (blocks: unknown[]) => ({
    ...validPayload,
    sections: [{ id: 's1', no: 1, title: 'Intro', blocks }],
    decisions: [],
  })

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })
  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView
  })

  async function open(payload: unknown) {
    window.history.replaceState(null, '', '/s/abc12345678901/')
    const envelope = { ...validEnvelope, payload: JSON.stringify(payload) }
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url.endsWith('/state') ? new Response(JSON.stringify({ state: null })) : new Response(JSON.stringify(envelope)),
        ),
      ),
    )
    render(<SessionPage />)
    await screen.findByRole('navigation', { name: 'Outline' })
  }

  it('has no row for a document without a trajectory block', async () => {
    await open(withBlocks([{ type: 'p', text: 'Hello' }]))
    expect(screen.queryByRole('link', { name: /Agent trail/ })).not.toBeInTheDocument()
  })

  it('counts the flagged steps and scrolls to the trajectory block, opening the details that holds it', async () => {
    await open(withBlocks([{ type: 'p', text: 'Hello' }, { type: 'details', summary: 'Trail', blocks: [trajectory] }]))
    const row = screen.getByRole('link', { name: 'Agent trail 2 flags' })
    const card = screen.getByText('trajectory').closest('figure')!
    const scroll = vi.fn()
    card.scrollIntoView = scroll

    fireEvent.click(row)

    expect(scroll).toHaveBeenCalledTimes(1)
    expect(card.closest('details')).toHaveAttribute('open')
  })
})
