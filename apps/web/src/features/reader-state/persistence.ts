import { coerceState } from './coerce'
import type { ReaderState } from './store'

function storageKey(sessionId: string): string {
  return `idocs:${sessionId}`
}

/** Reads and parses the persisted state for a session. Never throws; returns
 * null when nothing is stored, storage is unavailable (SSR, private mode),
 * or the stored value is corrupt. */
export function loadPersistedState(sessionId: string): ReaderState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId))
    if (raw === null) return null
    return coerceState(JSON.parse(raw))
  } catch {
    return null
  }
}

/** Whether the session has an entry in localStorage at all, independent of
 * whether it parses cleanly. Used by sync.ts to decide hydration precedence. */
export function hasPersistedState(sessionId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(storageKey(sessionId)) !== null
  } catch {
    return false
  }
}

/** Best-effort removal of the persisted entry for a session. Used by the
 * protected-session (memory-only) path to scrub plaintext reader state that
 * an earlier, pre-fix visit may have written for the same session. Never
 * throws (SSR, private mode). */
export function clearPersistedState(sessionId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKey(sessionId))
  } catch {
    // storage unavailable: nothing to scrub
  }
}

function syncMarkKey(sessionId: string): string {
  return `idocs-synced:${sessionId}`
}

/** The fingerprint of the server copy this browser last saw (a GET it matched or
 * hydrated from, or a PUT the server accepted), or null when it never synced.
 * sync.ts compares it with the server copy at load to tell whether another device
 * wrote since. Never throws. */
export function loadSyncMark(sessionId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(syncMarkKey(sessionId))
  } catch {
    return null
  }
}

export function saveSyncMark(sessionId: string, mark: string): void {
  try {
    window.localStorage.setItem(syncMarkKey(sessionId), mark)
  } catch {
    // private mode / quota exceeded: the next load falls back to local wins
  }
}

const pendingWrites = new Map<string, { timer: ReturnType<typeof setTimeout>; state: ReaderState }>()

function writeState(sessionId: string, state: ReaderState): void {
  try {
    window.localStorage.setItem(
      storageKey(sessionId),
      JSON.stringify({
        dsel: state.dsel,
        dnote: state.dnote,
        dother: state.dother,
        tflag: state.tflag,
        highlights: state.highlights,
      }),
    )
  } catch {
    // private mode / quota exceeded: persistence just does not happen
  }
}

/** Cancels a pending debounced write scheduled by schedulePersist for this
 * session, if one exists. Used by stopPersistence (bug-250) so a write
 * already queued before persistence was stopped cannot fire afterwards and
 * silently resurrect an entry clearPersistedState just removed. */
export function cancelPendingPersist(sessionId: string): void {
  const pending = pendingWrites.get(sessionId)
  if (pending !== undefined) {
    clearTimeout(pending.timer)
    pendingWrites.delete(sessionId)
  }
}

// The deferred write dies with the page, so a reload or a closed tab right
// after an action would drop it: write everything still pending at once.
function flushPendingPersists(): void {
  for (const [sessionId, { state }] of pendingWrites) {
    cancelPendingPersist(sessionId)
    writeState(sessionId, state)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPendingPersists)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingPersists()
  })
}

/** Schedules a write of `state` for `sessionId`, deferred to the next timer
 * tick. Multiple calls within the same tick collapse into a single write of
 * the latest state, since each call clears the previous session's pending
 * timer before scheduling a new one. A write still pending when the page
 * hides is flushed at once. */
export function schedulePersist(sessionId: string, state: ReaderState): void {
  if (typeof window === 'undefined') return
  cancelPendingPersist(sessionId)
  const timer = setTimeout(() => {
    pendingWrites.delete(sessionId)
    writeState(sessionId, state)
  }, 0)
  pendingWrites.set(sessionId, { timer, state })
}
