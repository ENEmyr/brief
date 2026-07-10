import { StrictMode } from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ReaderStateProvider, useReaderActions, useReaderState } from '@/features/reader-state'

const SESSION_ID = 'protsess1234567'
const STORAGE_KEY = `idocs:${SESSION_ID}`

/** Probe that exposes the store through real provider consumers: a button
 * that adds a highlight and a live count of highlights in the store. */
function Probe() {
  const actions = useReaderActions()
  const state = useReaderState()
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          actions.addHighlight({ id: 'h1', sid: 0, bid: 0, start: 0, end: 5, text: 'Hello', note: null })
        }
      >
        add
      </button>
      <span data-testid="count">{state.highlights.length}</span>
    </div>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('ReaderStateProvider persist={false} (protected sessions, memory-only)', () => {
  it('never writes localStorage and never touches the network, even after a mutation', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null })))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <ReaderStateProvider sessionId={SESSION_ID} persist={false}>
        <Probe />
      </ReaderStateProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'add' }))
    expect(screen.getByTestId('count')).toHaveTextContent('1')

    // Flush the 0ms persist debounce and the 5000ms KV-sync debounce alike:
    // neither may have been armed at all for a memory-only store.
    vi.runAllTimers()

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not hydrate from a pre-existing localStorage entry', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        highlights: [{ id: 'old', sid: 0, bid: 0, start: 0, end: 3, text: 'old', note: null }],
        dsel: {},
        dnote: {},
      }),
    )
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))

    render(
      <ReaderStateProvider sessionId={SESSION_ID} persist={false}>
        <Probe />
      </ReaderStateProvider>,
    )

    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('removes a leftover localStorage entry on mount (pre-fix plaintext hygiene)', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ highlights: [], dsel: {}, dnote: { d1: 'secret' } }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))

    render(
      <ReaderStateProvider sessionId={SESSION_ID} persist={false}>
        <Probe />
      </ReaderStateProvider>,
    )

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('stays memory-only under React StrictMode (double effect run, no network, no storage)', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ highlights: [], dsel: {}, dnote: { d1: 'x' } }))
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null })))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <StrictMode>
        <ReaderStateProvider sessionId={SESSION_ID} persist={false}>
          <Probe />
        </ReaderStateProvider>
      </StrictMode>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'add' }))
    vi.runAllTimers()

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('control: the default (persist omitted) still persists to localStorage and starts KV sync', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null })))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <ReaderStateProvider sessionId={SESSION_ID}>
        <Probe />
      </ReaderStateProvider>,
    )
    // The KV-sync mount GET fires immediately for a persisted session.
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`/api/session/${SESSION_ID}/state`))

    fireEvent.click(screen.getByRole('button', { name: 'add' }))
    vi.runAllTimers()

    const stored = window.localStorage.getItem(STORAGE_KEY)
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored!).highlights).toHaveLength(1)
  })
})
