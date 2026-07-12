import { API_URL } from '@/shared/api'
import { hasPersistedState } from './persistence'
import { coerceState } from './coerce'
import type { ReaderState, ReaderStateStore } from './store'

const DEBOUNCE_MS = 5000

interface StateResponseBody {
  state: string | null
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
 * session (local always wins when present) AND nothing mutated the store
 * while the GET was in flight -- a mutation-tracking subscription is
 * registered before the fetch fires so a user action during the request
 * can never be clobbered by stale remote state. After that, subscribes to
 * the store and PUTs the full state back 5000ms after the last mutation,
 * collapsing bursts into a single request. Failures are swallowed silently
 * (the local store stays authoritative either way). Returns a cleanup that
 * cancels any pending PUT, unsubscribes, and ignores a GET that resolves
 * after cleanup. */
export function startKvSync(sessionId: string, store: ReaderStateStore): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let unsubscribe: (() => void) | undefined
  let cancelled = false
  let mutatedSinceStart = false

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

  // Track mutations from before the GET fires, so a user action made while
  // the request is in flight blocks hydration below instead of being lost.
  unsubscribe = store.subscribe(() => {
    mutatedSinceStart = true
  })

  void (async () => {
    const hadLocal = hasPersistedState(sessionId)
    const remote = await fetchRemoteState(sessionId)
    if (cancelled) return
    // Swap the tracker out before hydrating: hydrate() notifies subscribers,
    // and it must neither set the mutation flag nor arm the sync debounce
    // (that would PUT straight back what was just pulled from KV).
    unsubscribe?.()
    if (!hadLocal && remote && !mutatedSinceStart) {
      store.actions.hydrate(remote)
    }
    unsubscribe = store.subscribe(scheduleSync)
    // A mutation that raced the GET was persisted locally but never armed
    // the debounce (the sync subscription did not exist yet) -- arm it now
    // so that state still reaches KV.
    if (mutatedSinceStart) scheduleSync()
  })()

  return () => {
    cancelled = true
    if (timer !== undefined) clearTimeout(timer)
    unsubscribe?.()
  }
}
