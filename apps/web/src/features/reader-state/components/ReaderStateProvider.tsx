'use client'
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { createReaderStateStore } from '../store'
import type { ReaderState, ReaderStateActions, ReaderStateStore } from '../store'
import { clearPersistedState } from '../persistence'
import { startKvSync } from '../sync'

const ReaderStateContext = createContext<ReaderStateStore | null>(null)

const SERVER_SNAPSHOT: ReaderState = { highlights: [], dsel: {}, dnote: {} }

/** Owns one reader-state store per sessionId: creates it (hydrating from
 * localStorage synchronously, which is safe on the server since that read
 * is a no-op there), starts KV sync for its lifetime, and exposes both via
 * context for useReaderState()/useReaderActions().
 *
 * With `persist={false}` (protected/end-to-end-encrypted sessions) the
 * store runs purely in memory: no localStorage hydration or writes, and no
 * KV sync in either direction -- the state endpoint is unauthenticated, so
 * payload-derived text must never leave the device unencrypted. Any
 * leftover persisted entry for the session is scrubbed on mount, since a
 * visit from before this rule existed may have written plaintext. */
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

  useEffect(() => {
    if (!persist) {
      // Memory-only mode: no KV sync at all. Scrub any plaintext reader
      // state a pre-fix visit persisted for this session (best-effort,
      // idempotent -- safe under StrictMode's double effect run).
      clearPersistedState(sessionId)
      return
    }
    return startKvSync(sessionId, store)
  }, [sessionId, store, persist])

  return <ReaderStateContext.Provider value={store}>{children}</ReaderStateContext.Provider>
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
