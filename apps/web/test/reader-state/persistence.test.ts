import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createReaderStateStore } from '@/features/reader-state'

const sessionId = 'sess-persist-test'
const key = `idocs:${sessionId}`

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState
})

describe('the deferred localStorage write', () => {
  it('is written at once when the page hides before its timer fires', () => {
    const store = createReaderStateStore(sessionId)
    store.actions.pickOption('d1', 'a', false)
    expect(localStorage.getItem(key)).toBeNull()
    window.dispatchEvent(new Event('pagehide'))
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ dsel: { d1: ['a'] }, dnote: {}, dother: {}, highlights: [] })
  })

  it('is written at once when the tab is switched away before its timer fires', () => {
    const store = createReaderStateStore(sessionId)
    store.actions.pickOption('d1', 'b', false)
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(JSON.parse(localStorage.getItem(key)!).dsel).toEqual({ d1: ['b'] })
  })

  it('is not written again by its timer after a flush', () => {
    const store = createReaderStateStore(sessionId)
    store.actions.pickOption('d1', 'a', false)
    window.dispatchEvent(new Event('pagehide'))
    localStorage.removeItem(key)
    vi.runAllTimers()
    expect(localStorage.getItem(key)).toBeNull()
  })
})
