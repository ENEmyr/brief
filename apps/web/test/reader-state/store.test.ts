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
    expect(store.getState()).toEqual({ highlights: [], dsel: {}, dnote: {}, dother: {} })
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

  it('pickOther single-select picks Other with no text and clears the agent option', () => {
    const store = createReaderStateStore(sessionId)
    store.actions.pickOption('d1', 'opt-a', false)
    store.actions.pickOther('d1', false)
    expect(store.getState().dsel).toEqual({})
    expect(store.getState().dother).toEqual({ d1: '' })
  })

  it('pickOther single-select picked twice keeps Other and its text, like a radio', () => {
    const store = createReaderStateStore(sessionId)
    store.actions.pickOther('d1', false)
    store.actions.setOtherText('d1', '300 a minute')
    store.actions.pickOther('d1', false)
    expect(store.getState().dother).toEqual({ d1: '300 a minute' })
  })

  it('pickOption single-select after Other drops the Other answer', () => {
    const store = createReaderStateStore(sessionId)
    store.actions.pickOther('d1', false)
    store.actions.setOtherText('d1', 'mine')
    store.actions.pickOption('d1', 'opt-a', false)
    expect(store.getState().dsel).toEqual({ d1: ['opt-a'] })
    expect(store.getState().dother).toEqual({})
  })

  it('pickOther multi-select toggles Other beside the agent options', () => {
    const store = createReaderStateStore(sessionId)
    store.actions.pickOption('d1', 'opt-a', true)
    store.actions.pickOther('d1', true)
    store.actions.setOtherText('d1', 'mine')
    expect(store.getState().dsel).toEqual({ d1: ['opt-a'] })
    expect(store.getState().dother).toEqual({ d1: 'mine' })
    store.actions.pickOption('d1', 'opt-b', true)
    expect(store.getState().dother).toEqual({ d1: 'mine' })
    store.actions.pickOther('d1', true)
    expect(store.getState().dother).toEqual({})
    expect(store.getState().dsel).toEqual({ d1: ['opt-a', 'opt-b'] })
  })

  it('setOtherText stores the reader answer per decision id', () => {
    const store = createReaderStateStore(sessionId)
    store.actions.setOtherText('d1', 'one')
    store.actions.setOtherText('d2', 'two')
    expect(store.getState().dother).toEqual({ d1: 'one', d2: 'two' })
  })

  it('setDecisionNote stores free text per decision id', () => {
    const store = createReaderStateStore(sessionId)
    store.actions.setDecisionNote('d1', 'hello')
    store.actions.setDecisionNote('d2', 'world')
    expect(store.getState().dnote).toEqual({ d1: 'hello', d2: 'world' })
  })

  it('resetDecisions clears dsel, dnote and dother but keeps highlights', () => {
    const store = createReaderStateStore(sessionId)
    store.actions.addHighlight(makeHighlight())
    store.actions.pickOption('d1', 'opt-a', false)
    store.actions.setDecisionNote('d1', 'hello')
    store.actions.pickOther('d2', false)
    store.actions.setOtherText('d2', 'mine')
    store.actions.resetDecisions()
    const state = store.getState()
    expect(state.dsel).toEqual({})
    expect(state.dnote).toEqual({})
    expect(state.dother).toEqual({})
    expect(state.highlights).toEqual([makeHighlight()])
  })

  it('hydrate replaces the whole state', () => {
    const store = createReaderStateStore(sessionId)
    store.actions.addHighlight(makeHighlight())
    store.actions.hydrate({ highlights: [], dsel: { d1: ['x'] }, dnote: {}, dother: { d2: 'mine' } })
    expect(store.getState()).toEqual({ highlights: [], dsel: { d1: ['x'] }, dnote: {}, dother: { d2: 'mine' } })
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
      JSON.stringify({ highlights: [makeHighlight()], dsel: { d1: ['x'] }, dnote: { d1: 'n' }, dother: { d2: 'mine' } }),
    )
    const store = createReaderStateStore(sessionId)
    expect(store.getState()).toEqual({
      highlights: [makeHighlight()],
      dsel: { d1: ['x'] },
      dnote: { d1: 'n' },
      dother: { d2: 'mine' },
    })
  })

  it('drops an Other answer that is not text, and a dother that is not a record', () => {
    localStorage.setItem(
      `idocs:${sessionId}`,
      JSON.stringify({ highlights: [], dsel: {}, dnote: {}, dother: { d1: 'kept', d2: 42, d3: null, d4: ['x'] } }),
    )
    expect(createReaderStateStore(sessionId).getState().dother).toEqual({ d1: 'kept' })
    localStorage.setItem(`idocs:${sessionId}`, JSON.stringify({ highlights: [], dsel: {}, dnote: {}, dother: ['d1'] }))
    expect(createReaderStateStore(sessionId).getState().dother).toEqual({})
  })

  it('loads state saved before Other existed as nothing picked', () => {
    localStorage.setItem(`idocs:${sessionId}`, JSON.stringify({ highlights: [], dsel: { d1: ['x'] }, dnote: {} }))
    const store = createReaderStateStore(sessionId)
    expect(store.getState().dother).toEqual({})
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

  it('writes the Other answers with the rest of the state', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const store = createReaderStateStore(sessionId)
    store.actions.pickOther('d1', false)
    store.actions.setOtherText('d1', '300 a minute')
    vi.runAllTimers()
    const [, value] = setItemSpy.mock.calls[0]!
    expect(JSON.parse(value)).toEqual({ dsel: {}, dnote: {}, dother: { d1: '300 a minute' }, highlights: [] })
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
