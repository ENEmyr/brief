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
    expect(store.getState()).toEqual({ highlights: [], dsel: {}, dnote: {}, dother: {} })
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
    expect(state.dother).toEqual({})
    stop()
  })

  it('sends the Other answers in the PUT body', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: null })))
    vi.stubGlobal('fetch', mockFetch)
    const store = createReaderStateStore(sessionId)
    const stop = startKvSync(sessionId, store)
    await flushMicrotasks()
    mockFetch.mockClear()

    store.actions.pickOther('d2', false)
    store.actions.setOtherText('d2', '300 a minute')
    vi.advanceTimersByTime(5000)
    await flushMicrotasks()

    const [, init] = mockFetch.mock.calls[0]!
    expect(JSON.parse(JSON.parse(init.body).state)).toEqual({
      dsel: {},
      dnote: {},
      dother: { d2: '300 a minute' },
      highlights: [],
    })
    stop()
  })

  it('hydrates the Other answers from remote state', async () => {
    const remote = { highlights: [], dsel: {}, dnote: {}, dother: { d2: 'from another device' } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: JSON.stringify(remote) }))))
    const store = createReaderStateStore(sessionId)
    const stop = startKvSync(sessionId, store)
    await flushMicrotasks()
    expect(store.getState().dother).toEqual({ d2: 'from another device' })
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

describe('startKvSync status (save chip)', () => {
  async function editAndFlush(store: ReturnType<typeof createReaderStateStore>) {
    store.actions.pickOption('d1', 'a', false)
    vi.advanceTimersByTime(5000)
    await flushMicrotasks()
  }

  async function startWith(putResult: () => Promise<Response>) {
    const mockFetch = vi.fn((_url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? putResult() : Promise.resolve(new Response(JSON.stringify({ state: null }))),
    )
    vi.stubGlobal('fetch', mockFetch)
    const store = createReaderStateStore(sessionId)
    const statuses: string[] = []
    const stop = startKvSync(sessionId, store, (s) => statuses.push(s))
    await flushMicrotasks()
    return { store, statuses, stop }
  }

  it('reports saving on an edit, then saved when the PUT answers 2xx', async () => {
    const { store, statuses, stop } = await startWith(() => Promise.resolve(new Response('{}', { status: 200 })))
    await editAndFlush(store)
    expect(statuses).toEqual(['saving', 'saved'])
    stop()
  })

  it('reports failed when the PUT never reaches the server (network error)', async () => {
    const { store, statuses, stop } = await startWith(() => Promise.reject(new TypeError('Failed to fetch')))
    await editAndFlush(store)
    expect(statuses).toEqual(['saving', 'failed'])
    stop()
  })

  it.each([400, 403, 404, 413, 429, 500])('reports failed when the PUT answers %i', async (status) => {
    const { store, statuses, stop } = await startWith(() => Promise.resolve(new Response('{}', { status })))
    await editAndFlush(store)
    expect(statuses).toEqual(['saving', 'failed'])
    stop()
  })

  it('a failure clears once a later PUT succeeds', async () => {
    let ok = false
    const { store, statuses, stop } = await startWith(() =>
      Promise.resolve(new Response('{}', { status: ok ? 200 : 503 })),
    )
    await editAndFlush(store)
    ok = true
    await editAndFlush(store)
    expect(statuses).toEqual(['saving', 'failed', 'saving', 'saved'])
    stop()
  })

  it('an older PUT that settles after a newer edit does not report over it', async () => {
    let resolveFirst: (res: Response) => void = () => {}
    const { store, statuses, stop } = await startWith(
      () => new Promise<Response>((resolve) => (resolveFirst = resolve)),
    )
    store.actions.pickOption('d1', 'a', false)
    vi.advanceTimersByTime(5000)
    store.actions.pickOption('d1', 'b', false)
    resolveFirst(new Response('{}', { status: 200 }))
    await flushMicrotasks()
    expect(statuses).toEqual(['saving', 'saving'])
    stop()
  })

  it('reports nothing after cleanup', async () => {
    let resolvePut: (res: Response) => void = () => {}
    const { store, statuses, stop } = await startWith(
      () => new Promise<Response>((resolve) => (resolvePut = resolve)),
    )
    store.actions.pickOption('d1', 'a', false)
    vi.advanceTimersByTime(5000)
    stop()
    resolvePut(new Response('{}', { status: 500 }))
    await flushMicrotasks()
    expect(statuses).toEqual(['saving'])
  })
})
