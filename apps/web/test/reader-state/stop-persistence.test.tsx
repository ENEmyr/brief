import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ReaderStateProvider, useReaderActions, useReaderState, useReaderStateStore } from '@/features/reader-state'

// bug-250: an in-view encrypt save purges the server's plaintext state:<id>
// KV blob. A persist=true ReaderStateProvider mounted before that save must
// stop persisting/syncing for good once it happens -- otherwise the next
// highlight/note mutation PUTs plaintext right back to the endpoint the
// server just purged. These tests exercise the store/provider mechanism
// (useReaderStateStore().stopPersistence()) directly; the full encrypt-save
// -> highlight integration is covered in test/reader/session-view.test.tsx.

const SESSION_ID = 'stopsess1234567'
const STORAGE_KEY = `idocs:${SESSION_ID}`

function Probe() {
  const actions = useReaderActions()
  const state = useReaderState()
  const store = useReaderStateStore()
  return (
    <div>
      <button type="button" onClick={() => store.stopPersistence()}>
        stop
      </button>
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

describe('ReaderStateProvider stopPersistence (bug-250)', () => {
  it('a mutation after stopPersistence neither writes localStorage nor PUTs to KV, and stays visible in memory', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null })))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <ReaderStateProvider sessionId={SESSION_ID}>
        <Probe />
      </ReaderStateProvider>,
    )
    // The default persist=true mount-time KV-sync GET fires.
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`/api/session/${SESSION_ID}/state`))

    fireEvent.click(screen.getByRole('button', { name: 'stop' }))
    fetchMock.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'add' }))
    // In-memory state must still update -- stopPersistence only disables
    // future persistence, it does not blank existing/new annotations.
    expect(screen.getByTestId('count')).toHaveTextContent('1')

    // Flush both the 0ms local-write debounce and the 5000ms KV-sync debounce.
    vi.runAllTimers()

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('clears an existing localStorage entry immediately when stopPersistence is called', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ highlights: [], dsel: {}, dnote: { d1: 'plaintext note' } }),
    )
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))

    render(
      <ReaderStateProvider sessionId={SESSION_ID}>
        <Probe />
      </ReaderStateProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'stop' }))

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('cancels an already-pending debounced localStorage write instead of letting it resurrect the cleared entry', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null }))))

    render(
      <ReaderStateProvider sessionId={SESSION_ID}>
        <Probe />
      </ReaderStateProvider>,
    )
    // Schedules the 0ms persist write, but does not flush it yet.
    fireEvent.click(screen.getByRole('button', { name: 'add' }))
    // stopPersistence must cancel that pending write, not race it.
    fireEvent.click(screen.getByRole('button', { name: 'stop' }))

    vi.runAllTimers()

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('calling stopPersistence twice is safe (idempotent, no error, no resurrection)', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null })))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <ReaderStateProvider sessionId={SESSION_ID}>
        <Probe />
      </ReaderStateProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'stop' }))
    fireEvent.click(screen.getByRole('button', { name: 'stop' }))
    fetchMock.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'add' }))
    vi.runAllTimers()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
