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

/** Leaves the sync mark a real first load leaves: no local entry, the server
 * answers `synced`, the store hydrates from it and the mark is saved. */
async function syncMarkFor(synced: object) {
  localStorage.removeItem(`idocs:${sessionId}`)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: JSON.stringify(synced) }))))
  const stop = startKvSync(sessionId, createReaderStateStore(sessionId))
  await flushMicrotasks()
  stop()
  expect(localStorage.getItem(`idocs-synced:${sessionId}`)).not.toBeNull()
}

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

  // A browser without a sync mark now takes a differing server copy (d066), so
  // local wins only once this browser synced the copy the server still holds.
  it('keeps local state when localStorage has an entry and the server copy has not moved since the last sync', async () => {
    await syncMarkFor({ highlights: [], dsel: { d1: ['remote'] }, dnote: {} })
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

  it('sends the PUT and does not throw when it is rejected', async () => {
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

describe('startKvSync when the page hides', () => {
  function setVisibility(state: DocumentVisibilityState) {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  }

  afterEach(() => {
    delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState
  })

  async function startSyncing(putResult: () => Promise<Response> = () => Promise.resolve(new Response(null, { status: 204 }))) {
    const mockFetch = vi.fn((_url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? putResult() : Promise.resolve(new Response(JSON.stringify({ state: null }))),
    )
    vi.stubGlobal('fetch', mockFetch)
    const store = createReaderStateStore(sessionId)
    const statuses: string[] = []
    const stop = startKvSync(sessionId, store, (s) => statuses.push(s))
    await flushMicrotasks()
    mockFetch.mockClear()
    const puts = () => mockFetch.mock.calls.map(([, init]) => init!)
    return { store, statuses, stop, puts }
  }

  it('a reload inside the debounce sends the pending PUT at once, with keepalive, and only once', async () => {
    const { store, stop, puts } = await startSyncing()
    window.dispatchEvent(new Event('pagehide'))
    expect(puts()).toEqual([])

    store.actions.pickOption('d1', 'a', false)
    vi.advanceTimersByTime(1000)
    window.dispatchEvent(new Event('pagehide'))
    setVisibility('hidden')
    expect(puts()).toHaveLength(1)
    expect(puts()[0]).toMatchObject({ method: 'PUT', keepalive: true })
    expect(JSON.parse(JSON.parse(String(puts()[0]!.body)).state).dsel).toEqual({ d1: ['a'] })

    await vi.advanceTimersByTimeAsync(10_000)
    expect(puts()).toHaveLength(1)
    stop()
  })

  it('switching away from the tab sends the pending PUT; coming back does not', async () => {
    const { store, stop, puts } = await startSyncing()
    store.actions.setDecisionNote('d1', 'cheaper')
    setVisibility('visible')
    expect(puts()).toEqual([])
    setVisibility('hidden')
    expect(puts()).toHaveLength(1)
    expect(JSON.parse(JSON.parse(String(puts()[0]!.body)).state).dnote).toEqual({ d1: 'cheaper' })
    stop()
  })

  it('reports the flushed PUT to the save chip', async () => {
    const { store, statuses, stop } = await startSyncing(() => Promise.reject(new TypeError('Failed to fetch')))
    store.actions.pickOption('d1', 'a', false)
    window.dispatchEvent(new Event('pagehide'))
    await flushMicrotasks()
    expect(statuses).toEqual(['saving', 'failed'])
    stop()
  })

  it('sends a state past the 64 KiB keepalive limit without keepalive', async () => {
    const { store, stop, puts } = await startSyncing()
    store.actions.setDecisionNote('d1', 'x'.repeat(70_000))
    window.dispatchEvent(new Event('pagehide'))
    expect(puts()).toHaveLength(1)
    expect(puts()[0]).toMatchObject({ method: 'PUT', keepalive: false })
    stop()
  })

  it('sends nothing on a hide after cleanup, so a session encrypted mid-view never leaks', async () => {
    const { store, stop, puts } = await startSyncing()
    store.actions.pickOption('d1', 'a', false)
    stop()
    window.dispatchEvent(new Event('pagehide'))
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(puts()).toEqual([])
  })
})

describe('startKvSync when this browser holds a stored state', () => {
  const reason = 'r'.repeat(70_000)
  const local = { highlights: [], dsel: { d1: ['a'] }, dnote: { d1: reason }, dother: {} }

  function startWithRemote(remote: object | null, putStatus = 200) {
    localStorage.setItem(`idocs:${sessionId}`, JSON.stringify(local))
    const mockFetch = vi.fn((_url: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === 'PUT'
          ? new Response('{}', { status: putStatus })
          : new Response(JSON.stringify({ state: remote === null ? null : JSON.stringify(remote) })),
      ),
    )
    vi.stubGlobal('fetch', mockFetch)
    const store = createReaderStateStore(sessionId)
    const statuses: string[] = []
    const stop = startKvSync(sessionId, store, (s) => statuses.push(s))
    return { mockFetch, statuses, stop }
  }

  function putBodies(mockFetch: ReturnType<typeof vi.fn>) {
    return mockFetch.mock.calls
      .filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
      .map(([, init]) => JSON.parse(JSON.parse((init as RequestInit).body as string).state as string) as unknown)
  }

  it('PUTs it at once when the server has no copy, and reports saved only after the PUT answers', async () => {
    const { mockFetch, statuses, stop } = startWithRemote(null)
    expect(statuses).toEqual(['saving'])
    await flushMicrotasks()
    expect(putBodies(mockFetch)).toEqual([local])
    expect(statuses).toEqual(['saving', 'saved'])
    stop()
  })

  // Needs the mark: without one the differing server copy wins (d066).
  it('PUTs it when the server copy differs but has not moved since the last sync', async () => {
    const synced = { ...local, dnote: { d1: 'older' } }
    await syncMarkFor(synced)
    const { mockFetch, statuses, stop } = startWithRemote(synced)
    await flushMicrotasks()
    expect(putBodies(mockFetch)).toEqual([local])
    expect(statuses).toEqual(['saving', 'saved'])
    stop()
  })

  it('sends no PUT and reports saved when the server copy is the same', async () => {
    const { mockFetch, statuses, stop } = startWithRemote(local)
    await flushMicrotasks()
    expect(putBodies(mockFetch)).toEqual([])
    expect(statuses).toEqual(['saving', 'saved'])
    stop()
  })

  it('reports failed, never saved, when that PUT is rejected', async () => {
    const { statuses, stop } = startWithRemote(null, 503)
    await flushMicrotasks()
    expect(statuses).toEqual(['saving', 'failed'])
    stop()
  })
})

describe('startKvSync sync mark: server wins at load when it moved since the last sync', () => {
  const local = { highlights: [], dsel: { d1: ['local'] }, dnote: {}, dother: {} }
  const server = { highlights: [], dsel: { d1: ['server'] }, dnote: {}, dother: {} }
  const statePath = `/api/session/${sessionId}/state`

  async function loadWithLocal(remote: object | null) {
    localStorage.setItem(`idocs:${sessionId}`, JSON.stringify(local))
    const mockFetch = vi.fn((_url: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === 'PUT'
          ? new Response('{}')
          : new Response(JSON.stringify({ state: remote === null ? null : JSON.stringify(remote) })),
      ),
    )
    vi.stubGlobal('fetch', mockFetch)
    const store = createReaderStateStore(sessionId)
    const statuses: string[] = []
    const stop = startKvSync(sessionId, store, (s) => statuses.push(s))
    await flushMicrotasks()
    const calls = mockFetch.mock.calls.map(([url, init]) => {
      const path = url.slice(url.indexOf('/api/'))
      if (init?.method !== 'PUT') return [path, 'GET']
      return [path, 'PUT', JSON.parse(JSON.parse(init.body as string).state as string) as unknown]
    })
    stop()
    return { calls, state: store.getState(), statuses }
  }

  it('takes a differing server copy when this browser has no sync mark, and never PUTs the local copy', async () => {
    const { calls, state, statuses } = await loadWithLocal(server)
    expect(calls).toEqual([[statePath, 'GET']])
    expect(state).toEqual(server)
    expect(statuses).toEqual(['saving', 'saved'])
    expect(localStorage.getItem(`idocs-synced:${sessionId}`)).not.toBeNull()
  })

  it('PUTs the local copy when this browser has no sync mark and the server has no copy', async () => {
    const { calls, state, statuses } = await loadWithLocal(null)
    expect(calls).toEqual([[statePath, 'GET'], [statePath, 'PUT', local]])
    expect(state).toEqual(local)
    expect(statuses).toEqual(['saving', 'saved'])
  })

  it('takes the server copy when it moved since the mark', async () => {
    await syncMarkFor({ highlights: [], dsel: { d1: ['older'] }, dnote: {}, dother: {} })
    const { calls, state, statuses } = await loadWithLocal(server)
    expect(calls).toEqual([[statePath, 'GET']])
    expect(state).toEqual(server)
    expect(statuses).toEqual(['saving', 'saved'])
  })

  it('PUTs the local copy when the server copy still equals the mark', async () => {
    await syncMarkFor(server)
    const { calls, state, statuses } = await loadWithLocal(server)
    expect(calls).toEqual([[statePath, 'GET'], [statePath, 'PUT', local]])
    expect(state).toEqual(local)
    expect(statuses).toEqual(['saving', 'saved'])
  })
})
