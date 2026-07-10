import { API_URL } from '@/shared/api'
import { hasPersistedState } from './persistence'
import type { ReaderState, ReaderStateStore } from './store'

const DEBOUNCE_MS = 5000

interface StateResponseBody {
  state: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function coerceState(raw: unknown): ReaderState {
  const value = isRecord(raw) ? raw : {}
  return {
    highlights: Array.isArray(value.highlights) ? (value.highlights as ReaderState['highlights']) : [],
    dsel: isRecord(value.dsel) ? (value.dsel as ReaderState['dsel']) : {},
    dnote: isRecord(value.dnote) ? (value.dnote as ReaderState['dnote']) : {},
  }
}

function stateUrl(sessionId: string): string {
  return `${API_URL}/api/session/${encodeURIComponent(sessionId)}/state`
}

async function fetchRemoteState(sessionId: string): Promise<ReaderState | null> {
  try {
    const res = await fetch(stateUrl(sessionId))
    if (!res.ok) return null
    const body = (await res.json()) as StateResponseBody
    if (!body.state) return null
    return coerceState(JSON.parse(body.state))
  } catch {
    return null
  }
}

/** Starts KV sync for a session: on mount, GETs the remote state and
 * hydrates the store from it only when localStorage had no entry for this
 * session (local always wins when present). After that, subscribes to the
 * store and PUTs the full state back 5000ms after the last mutation,
 * collapsing bursts into a single request. Failures are swallowed silently
 * (the local store stays authoritative either way). Returns a cleanup that
 * cancels any pending PUT, unsubscribes, and ignores a GET that resolves
 * after cleanup. */
export function startKvSync(sessionId: string, store: ReaderStateStore): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let unsubscribe: (() => void) | undefined
  let cancelled = false

  function pushState(): void {
    const { highlights, dsel, dnote } = store.getState()
    const body = JSON.stringify({ state: JSON.stringify({ dsel, dnote, highlights }) })
    fetch(stateUrl(sessionId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => {
      // fire-and-forget: sync failures are silent, local state remains authoritative
    })
  }

  function scheduleSync(): void {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      pushState()
    }, DEBOUNCE_MS)
  }

  void (async () => {
    const hadLocal = hasPersistedState(sessionId)
    const remote = await fetchRemoteState(sessionId)
    if (cancelled) return
    if (!hadLocal && remote) {
      store.actions.hydrate(remote)
    }
    if (cancelled) return
    unsubscribe = store.subscribe(scheduleSync)
  })()

  return () => {
    cancelled = true
    if (timer !== undefined) clearTimeout(timer)
    unsubscribe?.()
  }
}
