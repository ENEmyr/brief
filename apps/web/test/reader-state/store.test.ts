import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createReaderStateStore } from '@/features/reader-state'
import type { Highlight } from '@/features/reader-state'

const sessionId = 'sess-store-test'

function makeHighlight(overrides: Partial<Highlight> = {}): Highlight {
  return {
    id: 'h1',
    sid: 0,
    bid: 1,
    start: 0,
    end: 4,
    text: 'text',
    note: null,
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('createReaderStateStore', () => {
  it('starts with an empty state when nothing is persisted', () => {
    const store = createReaderStateStore(sessionId)
    expect(store.getState()).toEqual({ highlights: [], dsel: {}, dnote: {} })
  })

  it('addHighlight appends a highlight and notifies subscribers', () => {
    const store = createReaderStateStore(sessionId)
    const listener = vi.fn()
    store.subscribe(listener)
    store.actions.addHighlight(makeHighlight())
    expect(store.getState().highlights).toEqual([makeHighlight()])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('updateHighlight patches only the matching highlight', () => {
    const store = createReaderStateStore(sessionId)
    store.actions.addHighlight(makeHighlight({ id: 'h1' }))
    store.actions.addHighlight(makeHighlight({ id: 'h2' }))
    store.actions.updateHighlight('h1', { note: 'a note' })
    const [h1, h2] = store.getState().highlights
    expect(h1!.note).toBe('a note')
    expect(h2!.note).toBeNull()
  })

  it('updateHighlight can set a question', () => {
    const store = createReaderStateStore(sessionId)
    store.actions.addHighlight(makeHighlight({ id: 'h1' }))
    store.actions.updateHighlight('h1', { question: 'why?' })
    expect(store.getState().highlights[0]!.question).toBe('why?')
  })

  it('removeHighlight removes only the matching highlight', () => {
    const store = createReaderStateStore(sessionId)
    store.actions.addHighlight(makeHighlight({ id: 'h1' }))
    store.actions.addHighlight(makeHighlight({ id: 'h2' }))
    store.actions.removeHighlight('h1')
    expect(store.getState().highlights.map((h) => h.id)).toEqual(['h2'])
  })

  it('pickOption single-select replaces the array', () => {
    const store = createReaderStateStore(sessionId)
    store.actions.pickOption('d1', 'opt-a', false)
    store.actions.pickOption('d1', 'opt-b', false)
    expect(store.getState().dsel.d1).toEqual(['opt-b'])
  })

  it('pickOption multi-select toggles membership', () => {
    const store = createReaderStateStore(sessionId)
    store.actions.pickOption('d1', 'opt-a', true)
    store.actions.pickOption('d1', 'opt-b', true)
    expect(store.getState().dsel.d1!.sort()).toEqual(['opt-a', 'opt-b'])
    store.actions.pickOption('d1', 'opt-a', true)
    expect(store.getState().dsel.d1).toEqual(['opt-b'])
  })

  it('setDecisionNote stores free text per decision id', () => {
    const store = createReaderStateStore(sessionId)
    store.actions.setDecisionNote('d1', 'hello')
    store.actions.setDecisionNote('d2', 'world')
    expect(store.getState().dnote).toEqual({ d1: 'hello', d2: 'world' })
  })

  it('resetDecisions clears dsel/dnote but keeps highlights', () => {
    const store = createReaderStateStore(sessionId)
    store.actions.addHighlight(makeHighlight())
    store.actions.pickOption('d1', 'opt-a', false)
    store.actions.setDecisionNote('d1', 'hello')
    store.actions.resetDecisions()
    const state = store.getState()
    expect(state.dsel).toEqual({})
    expect(state.dnote).toEqual({})
    expect(state.highlights).toEqual([makeHighlight()])
  })

  it('hydrate replaces the whole state', () => {
    const store = createReaderStateStore(sessionId)
    store.actions.addHighlight(makeHighlight())
    store.actions.hydrate({ highlights: [], dsel: { d1: ['x'] }, dnote: {} })
    expect(store.getState()).toEqual({ highlights: [], dsel: { d1: ['x'] }, dnote: {} })
  })

  it('subscribe returns an unsubscribe function that stops notifications', () => {
    const store = createReaderStateStore(sessionId)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.actions.addHighlight(makeHighlight())
    expect(listener).not.toHaveBeenCalled()
  })

  it('loads persisted state from localStorage on creation', () => {
    localStorage.setItem(
      `idocs:${sessionId}`,
      JSON.stringify({ highlights: [makeHighlight()], dsel: { d1: ['x'] }, dnote: { d1: 'n' } }),
    )
    const store = createReaderStateStore(sessionId)
    expect(store.getState()).toEqual({ highlights: [makeHighlight()], dsel: { d1: ['x'] }, dnote: { d1: 'n' } })
  })
})

describe('persistence write coalescing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('collapses multiple mutations in one tick into a single localStorage write', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const store = createReaderStateStore(sessionId)
    store.actions.addHighlight(makeHighlight({ id: 'h1' }))
    store.actions.addHighlight(makeHighlight({ id: 'h2' }))
    store.actions.setDecisionNote('d1', 'hello')
    expect(setItemSpy).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(setItemSpy).toHaveBeenCalledTimes(1)
    const [key, value] = setItemSpy.mock.calls[0]!
    expect(key).toBe(`idocs:${sessionId}`)
    expect(JSON.parse(value).dnote).toEqual({ d1: 'hello' })
    expect(JSON.parse(value).highlights).toHaveLength(2)
    setItemSpy.mockRestore()
  })

  it('writes again for a mutation in a later tick', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const store = createReaderStateStore(sessionId)
    store.actions.addHighlight(makeHighlight({ id: 'h1' }))
    vi.runAllTimers()
    store.actions.addHighlight(makeHighlight({ id: 'h2' }))
    vi.runAllTimers()
    expect(setItemSpy).toHaveBeenCalledTimes(2)
    setItemSpy.mockRestore()
  })
})
