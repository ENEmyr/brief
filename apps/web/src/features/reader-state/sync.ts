import { API_URL } from '@/shared/api'
import { hasPersistedState, loadPersistedState, loadSyncMark, saveSyncMark } from './persistence'
import { coerceState } from './coerce'
import type { ReaderState, ReaderStateStore } from './store'

const DEBOUNCE_MS = 5000
// Browsers reject a keepalive request whose body passes 64 KiB, and a reader's state can be
// larger (the API takes 262,144 characters), so a bigger flush goes out as a plain request.
const KEEPALIVE_MAX_BYTES = 65_536

/** Where the latest edit lives: `saving` while a PUT is pending (debounce
 * included), `saved` once the server answered 2xx, `failed` when the PUT was
 * rejected (non-2xx) or never reached the server. A failure only clears when a
 * later PUT succeeds; the next edit re-sends the full state. */
export type SyncStatus = 'saving' | 'saved' | 'failed'

interface StateResponseBody {
  state: string | null
}

function serialize({ dsel, dnote, dother, tflag, highlights }: ReaderState): string {
  return JSON.stringify({ dsel, dnote, dother, tflag, highlights })
}

// cyrb53: a 53-bit string hash, enough to tell two serialized states apart.
function fingerprint(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
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
 * hydrates the store from it when localStorage had no entry for this session,
 * or when the server copy moved since this browser's last sync (see below),
 * AND nothing mutated the store while the GET was in flight -- a
 * mutation-tracking subscription is registered before the fetch fires so a
 * user action during the request can never be clobbered by stale remote
 * state. After that, subscribes to the store and PUTs the full state back
 * 5000ms after the last mutation,
 * collapsing bursts into a single request. The local store stays
 * authoritative either way; `onStatus` reports each PUT's outcome so the
 * reader can see whether the server has the answers. When the page is hidden
 * or unloaded (reload, closed tab, app switch) a pending PUT is sent at once,
 * with `keepalive` when its body fits the 64 KiB limit, since the debounce
 * timer dies with the page. Returns a cleanup that cancels any pending PUT,
 * unsubscribes, stops listening for the page hiding, and ignores a GET or PUT
 * that resolves after cleanup.
 *
 * A flush past 64 KiB, or one the network drops, can still die with the page.
 * So when this browser holds a stored state, the chip reads `saving` from the
 * start, and once the GET answers the local state is PUT at once unless the
 * server copy already equals it. The state API is last write wins, so a browser
 * takes the server copy instead when that copy changed since its sync mark, or
 * when it holds no mark at all (private mode, or a first sync that never
 * completed): another device wrote newer state, and it wins over any edit here
 * that never reached the server. */
export function startKvSync(
  sessionId: string,
  store: ReaderStateStore,
  onStatus: (status: SyncStatus) => void = () => {},
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let unsubscribe: (() => void) | undefined
  let cancelled = false
  let mutatedSinceStart = false
  let lastPut = 0
  const hasLocal = loadPersistedState(sessionId) !== null
  if (hasLocal) onStatus('saving')

  function settle(put: number, status: SyncStatus): void {
    // An older PUT must not report over a newer edit that is still pending.
    if (cancelled || put !== lastPut || timer !== undefined) return
    onStatus(status)
  }

  function pushState(keepalive = false): void {
    const state = serialize(store.getState())
    const body = JSON.stringify({ state })
    const put = ++lastPut
    fetch(stateUrl(sessionId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: keepalive && new Blob([body]).size <= KEEPALIVE_MAX_BYTES,
    }).then(
      (res) => {
        if (res.ok && !cancelled) saveSyncMark(sessionId, fingerprint(state))
        settle(put, res.ok ? 'saved' : 'failed')
      },
      () => settle(put, 'failed'),
    )
  }

  function scheduleSync(): void {
    onStatus('saving')
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      pushState()
    }, DEBOUNCE_MS)
  }

  function flushPending(): void {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
    pushState(true)
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'hidden') flushPending()
  }

  window.addEventListener('pagehide', flushPending)
  document.addEventListener('visibilitychange', onVisibilityChange)

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
    const remoteText = remote === null ? null : serialize(remote)
    const mark = loadSyncMark(sessionId)
    // With no mark (null) any server copy counts as moved.
    const serverMoved = remoteText !== null && fingerprint(remoteText) !== mark
    if (remote && !mutatedSinceStart && (!hadLocal || serverMoved)) {
      store.actions.hydrate(remote)
    }
    const inSync = remoteText !== null && remoteText === serialize(store.getState())
    if (inSync && !mutatedSinceStart) saveSyncMark(sessionId, fingerprint(remoteText))
    unsubscribe = store.subscribe(scheduleSync)
    // A mutation that raced the GET was persisted locally but never armed
    // the debounce (the sync subscription did not exist yet) -- arm it now
    // so that state still reaches KV.
    if (mutatedSinceStart) scheduleSync()
    else if (hasLocal) {
      if (inSync) onStatus('saved')
      else pushState()
    }
  })()

  return () => {
    cancelled = true
    if (timer !== undefined) clearTimeout(timer)
    unsubscribe?.()
    window.removeEventListener('pagehide', flushPending)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
