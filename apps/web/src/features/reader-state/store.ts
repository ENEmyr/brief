import { loadPersistedState, schedulePersist } from './persistence'

export type Highlight = {
  id: string
  sid: number
  bid: number
  start: number
  end: number
  text: string
  note: string | null
  question?: string
}

export type ReaderState = {
  highlights: Highlight[]
  dsel: Record<string, string[]> // decision id -> selected option IDs (always array; single-select = length 1)
  dnote: Record<string, string> // decision id -> free text note
}

export interface ReaderStateActions {
  addHighlight(h: Highlight): void
  updateHighlight(id: string, patch: Partial<Pick<Highlight, 'note' | 'question'>>): void
  removeHighlight(id: string): void
  pickOption(decisionId: string, optionId: string, multi: boolean): void
  setDecisionNote(decisionId: string, text: string): void
  resetDecisions(): void
  hydrate(state: ReaderState): void
}

export interface ReaderStateStore {
  getState(): ReaderState
  subscribe(listener: () => void): () => void
  actions: ReaderStateActions
}

const EMPTY_STATE: ReaderState = { highlights: [], dsel: {}, dnote: {} }

/** Creates an in-memory reader-state store for one session, seeded from
 * localStorage if a persisted entry exists. The returned shape matches
 * useSyncExternalStore's (subscribe, getState) contract. Every mutation
 * schedules a debounced localStorage write (see persistence.ts); KV sync is
 * wired separately by startKvSync (see sync.ts) so this module has no
 * network concerns. */
export function createReaderStateStore(sessionId: string): ReaderStateStore {
  let state: ReaderState = loadPersistedState(sessionId) ?? EMPTY_STATE
  const listeners = new Set<() => void>()

  function getState(): ReaderState {
    return state
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function commit(next: ReaderState): void {
    state = next
    schedulePersist(sessionId, next)
    listeners.forEach((listener) => listener())
  }

  const actions: ReaderStateActions = {
    addHighlight(h) {
      commit({ ...state, highlights: [...state.highlights, h] })
    },
    updateHighlight(id, patch) {
      commit({
        ...state,
        highlights: state.highlights.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      })
    },
    removeHighlight(id) {
      commit({ ...state, highlights: state.highlights.filter((h) => h.id !== id) })
    },
    pickOption(decisionId, optionId, multi) {
      const current = state.dsel[decisionId] ?? []
      const next = multi
        ? current.includes(optionId)
          ? current.filter((o) => o !== optionId)
          : [...current, optionId]
        : [optionId]
      commit({ ...state, dsel: { ...state.dsel, [decisionId]: next } })
    },
    setDecisionNote(decisionId, text) {
      commit({ ...state, dnote: { ...state.dnote, [decisionId]: text } })
    },
    resetDecisions() {
      commit({ ...state, dsel: {}, dnote: {} })
    },
    hydrate(next) {
      commit(next)
    },
  }

  return { getState, subscribe, actions }
}
