'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { createReaderStateStore } from '../store'
import type { ReaderState, ReaderStateActions, ReaderStateStore } from '../store'
import { cancelPendingPersist, clearPersistedState } from '../persistence'
import { startKvSync } from '../sync'

const ReaderStateContext = createContext<ReaderStateStore | null>(null)

const SERVER_SNAPSHOT: ReaderState = { highlights: [], dsel: {}, dnote: {} }

/** Owns one reader-state store per sessionId: creates it (hydrating from
 * localStorage synchronously, which is safe on the server since that read
 * is a no-op there), starts KV sync for its lifetime, and exposes both via
 * context for useReaderState()/useReaderActions()/useReaderStateStore().
 *
 * With `persist={false}` (protected/end-to-end-encrypted sessions) the
 * store runs purely in memory: no localStorage hydration or writes, and no
 * KV sync in either direction -- the state endpoint is unauthenticated, so
 * payload-derived text must never leave the device unencrypted. Any
 * leftover persisted entry for the session is scrubbed on mount, since a
 * visit from before this rule existed may have written plaintext.
 *
 * bug-250: a session can also become protected MID-VIEW, via an in-view
 * encrypt save -- at that instant the server purges its plaintext state:<id>
 * KV blob, but this provider (created with persist=true, since the session
 * wasn't protected on load) would otherwise keep syncing and re-leak
 * plaintext on the next mutation. The context value exposes
 * `stopPersistence()` for exactly that case: the caller (SessionView, once
 * it observes an encrypt save) calls it to durably disable local + KV
 * persistence for the rest of this store's lifetime, without unmounting the
 * provider or losing the in-memory annotations already on screen. */
export function ReaderStateProvider({
  sessionId,
  persist = true,
  children,
}: {
  sessionId: string
  persist?: boolean
  children: React.ReactNode
}) {
  const [store] = useState<ReaderStateStore>(() => createReaderStateStore(sessionId, { persist }))
  // Whether KV sync should be (re)started by the effect below. Starts equal
  // to `persist` and only ever flips true->false, via stopPersistence --
  // there is no path back to persisting once stopped.
  const [syncActive, setSyncActive] = useState(persist)

  const stopPersistence = useCallback(() => {
    setSyncActive(false)
    store.stopPersistence()
    // A write scheduled just before this call (0ms debounce) must not fire
    // after clearPersistedState below runs, or it would silently resurrect
    // the entry we are about to remove.
    cancelPendingPersist(sessionId)
    clearPersistedState(sessionId)
  }, [store, sessionId])

  // The context value is the store augmented with the wrapper stopPersistence
  // above (KV-sync teardown + localStorage clear), not the store's own bare
  // stopPersistence (local-write-suppression only). Stable across renders
  // unless the store or sessionId changes.
  const contextValue = useMemo<ReaderStateStore>(
    () => ({ ...store, stopPersistence }),
    [store, stopPersistence],
  )

  useEffect(() => {
    if (!persist) {
      // Memory-only mode: no KV sync at all. Scrub any plaintext reader
      // state a pre-fix visit persisted for this session (best-effort,
      // idempotent -- safe under StrictMode's double effect run).
      clearPersistedState(sessionId)
      return
    }
    if (!syncActive) return
    return startKvSync(sessionId, store)
  }, [sessionId, store, persist, syncActive])

  return <ReaderStateContext.Provider value={contextValue}>{children}</ReaderStateContext.Provider>
}

function useReaderStore(): ReaderStateStore {
  const store = useContext(ReaderStateContext)
  if (!store) {
    throw new Error('useReaderState/useReaderActions must be used within a ReaderStateProvider')
  }
  return store
}

export function useReaderState(): ReaderState {
  const store = useReaderStore()
  return useSyncExternalStore(store.subscribe, store.getState, () => SERVER_SNAPSHOT)
}

export function useReaderActions(): ReaderStateActions {
  return useReaderStore().actions
}

/** Returns the raw store handle (getState/subscribe/actions/stopPersistence)
 * without subscribing to it via useSyncExternalStore -- for consumers that
 * need imperative, on-demand access (read the current state inside a
 * callback, or call stopPersistence) without re-rendering on every
 * mutation. Compare useReaderState(), which subscribes and re-renders. */
export function useReaderStateStore(): ReaderStateStore {
  return useReaderStore()
}
