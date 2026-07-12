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

const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()

/** Cancels a pending debounced write scheduled by schedulePersist for this
 * session, if one exists. Used by stopPersistence (bug-250) so a write
 * already queued before persistence was stopped cannot fire afterwards and
 * silently resurrect an entry clearPersistedState just removed. */
export function cancelPendingPersist(sessionId: string): void {
  const existing = pendingWrites.get(sessionId)
  if (existing !== undefined) {
    clearTimeout(existing)
    pendingWrites.delete(sessionId)
  }
}

/** Schedules a write of `state` for `sessionId`, deferred to the next timer
 * tick. Multiple calls within the same tick collapse into a single write of
 * the latest state, since each call clears the previous session's pending
 * timer before scheduling a new one. */
export function schedulePersist(sessionId: string, state: ReaderState): void {
  if (typeof window === 'undefined') return
  const existing = pendingWrites.get(sessionId)
  if (existing !== undefined) clearTimeout(existing)
  const timer = setTimeout(() => {
    pendingWrites.delete(sessionId)
    try {
      window.localStorage.setItem(
        storageKey(sessionId),
        JSON.stringify({ dsel: state.dsel, dnote: state.dnote, highlights: state.highlights }),
      )
    } catch {
      // private mode / quota exceeded: persistence just does not happen
    }
  }, 0)
  pendingWrites.set(sessionId, timer)
}
