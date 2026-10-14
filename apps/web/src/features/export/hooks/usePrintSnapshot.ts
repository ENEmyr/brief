import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import type { ReaderStateStore } from '@/features/reader-state'
import { insertPrintNotes, type PrintSnapshot } from '../lib/printSheet'

/**
 * The browser renders the page for paper right after `beforeprint` returns,
 * which is why the render is flushed synchronously.
 */
export function usePrintSnapshot(store: ReaderStateStore, sessionId: string): PrintSnapshot | null {
  const [snapshot, setSnapshot] = useState<PrintSnapshot | null>(null)

  useEffect(() => {
    let removeNotes = () => {}
    function beforePrint() {
      const state = store.getState()
      const hostPath = `${window.location.host}/s/${sessionId}`
      flushSync(() => setSnapshot({ state, printedAt: new Date(), hostPath }))
      removeNotes()
      removeNotes = insertPrintNotes(document, state.highlights)
    }
    function afterPrint() {
      removeNotes()
      removeNotes = () => {}
      setSnapshot(null)
    }
    window.addEventListener('beforeprint', beforePrint)
    window.addEventListener('afterprint', afterPrint)
    return () => {
      window.removeEventListener('beforeprint', beforePrint)
      window.removeEventListener('afterprint', afterPrint)
      removeNotes()
    }
  }, [store, sessionId])

  return snapshot
}
