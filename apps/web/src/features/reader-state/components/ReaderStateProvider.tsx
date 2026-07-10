'use client'
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { createReaderStateStore } from '../store'
import type { ReaderState, ReaderStateActions, ReaderStateStore } from '../store'
import { startKvSync } from '../sync'

const ReaderStateContext = createContext<ReaderStateStore | null>(null)

const SERVER_SNAPSHOT: ReaderState = { highlights: [], dsel: {}, dnote: {} }

/** Owns one reader-state store per sessionId: creates it (hydrating from
 * localStorage synchronously, which is safe on the server since that read
 * is a no-op there), starts KV sync for its lifetime, and exposes both via
 * context for useReaderState()/useReaderActions(). */
export function ReaderStateProvider({
  sessionId,
  children,
}: {
  sessionId: string
  children: React.ReactNode
}) {
  const [store] = useState<ReaderStateStore>(() => createReaderStateStore(sessionId))

  useEffect(() => {
    return startKvSync(sessionId, store)
  }, [sessionId, store])

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
