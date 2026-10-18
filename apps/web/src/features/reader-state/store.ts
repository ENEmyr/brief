import { loadPersistedState, schedulePersist } from './persistence'

/** The leaf a highlight anchors to when it does not say otherwise. `p` blocks
 *  were the only annotatable thing before paths existed, and their one string
 *  field is `text`, so a stored highlight without a path is a paragraph's. */
export const DEFAULT_HIGHLIGHT_PATH = 'text'

export type Highlight = {
  id: string
  sid: number
  /** Index of the block within the section, or null for the section heading,
   *  which is not a block and therefore has no index. */
  bid: number | null
  /**
   * Which string inside the block this anchors to, as a dotted path into the
   * payload: `text`, `title`, `head.2`, `rows.1.0`, `items.3.label`.
   *
   * Offsets are into that ONE leaf string, which is what makes structured
   * blocks annotatable at all. A table has no single flat text to count
   * characters into; each cell does.
   *
   * Absent on highlights stored before paths existed; treat as
   * DEFAULT_HIGHLIGHT_PATH.
   */
  path?: string
  start: number
  end: number
  text: string
  note: string | null
  question?: string
}

export type ReaderState = {
  highlights: Highlight[]
  dsel: Record<string, string[]> // decision id -> the agent's option IDs picked (always array; single-select = length 1)
  dnote: Record<string, string> // decision id -> reason / extra context
  // decision id -> the reader's own answer. A key means "Other" is picked, even
  // before any text is typed, so Other never needs an option id that could
  // collide with one of the agent's.
  dother: Record<string, string>
  // trajectory block key -> step index -> the reader's mark on a flagged step.
  // Absent until the first mark, so state saved before marks existed reads the same.
  tflag?: Record<string, Record<string, TrajectoryMark>>
}

/** "Ask me" or "OK" on a step the agent decided alone or assumed. */
export type TrajectoryMark = 'ask' | 'ok'

export interface ReaderStateActions {
  addHighlight(h: Highlight): void
  updateHighlight(id: string, patch: Partial<Pick<Highlight, 'note' | 'question'>>): void
  removeHighlight(id: string): void
  pickOption(decisionId: string, optionId: string, multi: boolean): void
  pickOther(decisionId: string, multi: boolean): void
  setOtherText(decisionId: string, text: string): void
  setDecisionNote(decisionId: string, text: string): void
  /** Sets a step's mark, or clears it with null. */
  setStepMark(blockKey: string, step: number, mark: TrajectoryMark | null): void
  resetDecisions(): void
  hydrate(state: ReaderState): void
}

export interface ReaderStateStore {
  getState(): ReaderState
  subscribe(listener: () => void): () => void
  actions: ReaderStateActions
  /** Disables future localStorage persistence for this store instance (bug-250):
   * commit() stops calling schedulePersist. In-memory state and its
   * listeners are untouched -- annotations stay visible. Irreversible for
   * the lifetime of this store; ReaderStateProvider's wrapper additionally
   * tears down KV sync and clears any existing localStorage entry. */
  stopPersistence(): void
}

const EMPTY_STATE: ReaderState = { highlights: [], dsel: {}, dnote: {}, dother: {} }

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key))
}

/** Creates an in-memory reader-state store for one session, seeded from
 * localStorage if a persisted entry exists. The returned shape matches
 * useSyncExternalStore's (subscribe, getState) contract. Every mutation
 * schedules a debounced localStorage write (see persistence.ts); KV sync is
 * wired separately by startKvSync (see sync.ts) so this module has no
 * network concerns. With `persist: false` (protected sessions) the store is
 * purely in-memory: no localStorage hydration on create and no persistence
 * writes on mutation. */
export function createReaderStateStore(
  sessionId: string,
  options?: { persist?: boolean },
): ReaderStateStore {
  let persistEnabled = options?.persist ?? true
  let state: ReaderState = (persistEnabled ? loadPersistedState(sessionId) : null) ?? EMPTY_STATE
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
    if (persistEnabled) schedulePersist(sessionId, next)
    listeners.forEach((listener) => listener())
  }

  function stopPersistence(): void {
    persistEnabled = false
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
      if (!multi) {
        // A single-select holds one answer: the agent's option replaces Other.
        commit({
          ...state,
          dsel: { ...state.dsel, [decisionId]: [optionId] },
          dother: without(state.dother, decisionId),
        })
        return
      }
      const next = current.includes(optionId)
        ? current.filter((o) => o !== optionId)
        : [...current, optionId]
      commit({ ...state, dsel: { ...state.dsel, [decisionId]: next } })
    },
    pickOther(decisionId, multi) {
      const picked = Object.hasOwn(state.dother, decisionId)
      if (multi) {
        const dother = picked
          ? without(state.dother, decisionId)
          : { ...state.dother, [decisionId]: '' }
        commit({ ...state, dother })
        return
      }
      // Like any radio, picking Other again leaves it picked.
      if (picked) return
      commit({
        ...state,
        dsel: without(state.dsel, decisionId),
        dother: { ...state.dother, [decisionId]: '' },
      })
    },
    setOtherText(decisionId, text) {
      commit({ ...state, dother: { ...state.dother, [decisionId]: text } })
    },
    setDecisionNote(decisionId, text) {
      commit({ ...state, dnote: { ...state.dnote, [decisionId]: text } })
    },
    setStepMark(blockKey, step, mark) {
      const current = state.tflag?.[blockKey] ?? {}
      const marks = mark === null ? without(current, String(step)) : { ...current, [step]: mark }
      const others = without(state.tflag ?? {}, blockKey)
      const tflag = Object.keys(marks).length > 0 ? { ...others, [blockKey]: marks } : others
      commit({ ...state, tflag })
    },
    resetDecisions() {
      commit({ ...state, dsel: {}, dnote: {}, dother: {} })
    },
    hydrate(next) {
      commit(next)
    },
  }

  return { getState, subscribe, actions, stopPersistence }
}
