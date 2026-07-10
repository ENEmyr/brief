import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createReaderStateStore, startKvSync } from '@/features/reader-state'

const sessionId = 'sess-sync-test'

async function flushMicrotasks() {
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('startKvSync hydration precedence', () => {
  it('hydrates from remote state when localStorage has no entry for the session', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: JSON.stringify({ highlights: [], dsel: { d1: ['remote'] }, dnote: {} }) })))
    vi.stubGlobal('fetch', mockFetch)
    const store = createReaderStateStore(sessionId)
    const stop = startKvSync(sessionId, store)
    await flushMicrotasks()
    expect(store.getState().dsel).toEqual({ d1: ['remote'] })
    stop()
  })

  it('keeps local state when localStorage already has an entry, ignoring remote', async () => {
    localStorage.setItem(
      `idocs:${sessionId}`,
      JSON.stringify({ highlights: [], dsel: { d1: ['local'] }, dnote: {} }),
    )
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: JSON.stringify({ highlights: [], dsel: { d1: ['remote'] }, dnote: {} }) })))
    vi.stubGlobal('fetch', mockFetch)
    const store = createReaderStateStore(sessionId)
    const stop = startKvSync(sessionId, store)
    await flushMicrotasks()
    expect(store.getState().dsel).toEqual({ d1: ['local'] })
    stop()
  })

  it('does nothing when remote state is null', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null })))
    vi.stubGlobal('fetch', mockFetch)
    const store = createReaderStateStore(sessionId)
    const stop = startKvSync(sessionId, store)
    await flushMicrotasks()
    expect(store.getState()).toEqual({ highlights: [], dsel: {}, dnote: {} })
    stop()
  })
})

describe('startKvSync debounce', () => {
  it('fires exactly one PUT 5000ms after the last mutation in a burst', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null })))
    vi.stubGlobal('fetch', mockFetch)
    const store = createReaderStateStore(sessionId)
    const stop = startKvSync(sessionId, store)
    await flushMicrotasks()
    mockFetch.mockClear()

    store.actions.pickOption('d1', 'a', false)
    vi.advanceTimersByTime(2000)
    store.actions.pickOption('d1', 'b', false)
    vi.advanceTimersByTime(2000)
    store.actions.setDecisionNote('d1', 'hi')

    // still within the debounce window from the last mutation
    vi.advanceTimersByTime(4999)
    expect(mockFetch).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    await flushMicrotasks()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]!
    expect(url).toContain(`/api/session/${sessionId}/state`)
    expect(init.method).toBe('PUT')
    const body = JSON.parse(init.body)
    const state = JSON.parse(body.state)
    expect(state.dsel).toEqual({ d1: ['b'] })
    expect(state.dnote).toEqual({ d1: 'hi' })
    stop()
  })

  it('does not sync when the state is never mutated', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null })))
    vi.stubGlobal('fetch', mockFetch)
    const store = createReaderStateStore(sessionId)
    const stop = startKvSync(sessionId, store)
    await flushMicrotasks()
    mockFetch.mockClear()

    vi.advanceTimersByTime(10_000)
    await flushMicrotasks()

    expect(mockFetch).not.toHaveBeenCalled()
    stop()
  })

  it('silently swallows PUT failures', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ state: null })))
    mockFetch.mockRejectedValueOnce(new Error('network down'))
    vi.stubGlobal('fetch', mockFetch)
    const store = createReaderStateStore(sessionId)
    const stop = startKvSync(sessionId, store)
    await flushMicrotasks()

    store.actions.pickOption('d1', 'a', false)
    vi.advanceTimersByTime(5000)
    await flushMicrotasks()

    expect(mockFetch).toHaveBeenCalledTimes(2)
    stop()
  })
})

describe('startKvSync mutation during initial GET', () => {
  it('does not clobber a mutation made while the GET is in flight', async () => {
    let resolveGet!: (r: Response) => void
    const getPromise = new Promise<Response>((resolve) => {
      resolveGet = resolve
    })
    const mockFetch = vi.fn().mockReturnValueOnce(getPromise).mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', mockFetch)
    const store = createReaderStateStore(sessionId)
    const stop = startKvSync(sessionId, store)

    // user acts before the GET resolves (realistic on a first visit: no localStorage entry yet)
    store.actions.pickOption('d1', 'fresh-local', false)

    resolveGet(new Response(JSON.stringify({ state: JSON.stringify({ highlights: [], dsel: { d1: ['stale-remote'] }, dnote: {} }) })))
    await flushMicrotasks()

    expect(store.getState().dsel).toEqual({ d1: ['fresh-local'] })

    // the blocked hydration must not strand the mutation locally: it still syncs to KV
    await vi.advanceTimersByTimeAsync(5000)
    const put = mockFetch.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(put).toBeDefined()
    expect(JSON.parse(JSON.parse(put![1].body).state).dsel).toEqual({ d1: ['fresh-local'] })
    stop()
  })

  it('still hydrates from remote when nothing mutated while the GET was in flight', async () => {
    let resolveGet!: (r: Response) => void
    const getPromise = new Promise<Response>((resolve) => {
      resolveGet = resolve
    })
    const mockFetch = vi.fn().mockReturnValue(getPromise)
    vi.stubGlobal('fetch', mockFetch)
    const store = createReaderStateStore(sessionId)
    const stop = startKvSync(sessionId, store)

    resolveGet(new Response(JSON.stringify({ state: JSON.stringify({ highlights: [], dsel: { d1: ['remote'] }, dnote: {} }) })))
    await flushMicrotasks()

    expect(store.getState().dsel).toEqual({ d1: ['remote'] })

    // hydration itself must not arm the debounce and PUT the data straight back
    await vi.advanceTimersByTimeAsync(10_000)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    stop()
  })
})

describe('startKvSync cleanup', () => {
  it('cancels a pending PUT and stops listening after cleanup runs', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null })))
    vi.stubGlobal('fetch', mockFetch)
    const store = createReaderStateStore(sessionId)
    const stop = startKvSync(sessionId, store)
    await flushMicrotasks()
    mockFetch.mockClear()

    store.actions.pickOption('d1', 'a', false)
    vi.advanceTimersByTime(2000)
    stop()
    vi.advanceTimersByTime(10_000)
    await flushMicrotasks()

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not hydrate from a slow GET that resolves after cleanup', async () => {
    let resolveGet!: (r: Response) => void
    const getPromise = new Promise<Response>((resolve) => {
      resolveGet = resolve
    })
    const mockFetch = vi.fn().mockReturnValue(getPromise)
    vi.stubGlobal('fetch', mockFetch)
    const store = createReaderStateStore(sessionId)
    const stop = startKvSync(sessionId, store)
    stop()
    resolveGet(new Response(JSON.stringify({ state: JSON.stringify({ highlights: [], dsel: { d1: ['remote'] }, dnote: {} }) })))
    await flushMicrotasks()
    expect(store.getState().dsel).toEqual({})
  })
})
