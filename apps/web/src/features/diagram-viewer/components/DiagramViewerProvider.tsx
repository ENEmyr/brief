'use client'
import { createContext, useContext, useMemo } from 'react'
import { useViewer } from '../hooks/useViewer'
import { ViewerOverlay } from './ViewerOverlay'

export interface DiagramViewerContextValue {
  /** Key of the block currently expanded, or null. */
  expandedKey: string | null
  open: (ownerKey: string, node: React.ReactNode) => void
  sync: (ownerKey: string, node: React.ReactNode) => void
  close: () => void
}

// A no-op default so any consumer calling useDiagramViewer() outside a
// DiagramViewerProvider (e.g. a block component under a bare unit test) gets a
// harmless open()/close() instead of a crash.
const noop = () => {}
const defaultValue: DiagramViewerContextValue = {
  expandedKey: null,
  open: noop,
  sync: noop,
  close: noop,
}

const DiagramViewerContext = createContext<DiagramViewerContextValue>(defaultValue)

/**
 * Owns the single fullscreen diagram viewer for its subtree: holds the
 * useViewer() state and renders one ViewerOverlay after `children`, so any
 * descendant can expand a diagram without each block owning an overlay.
 */
export function DiagramViewerProvider({ children }: { children: React.ReactNode }) {
  const { content, open, sync, close } = useViewer()

  const value = useMemo(
    () => ({ expandedKey: content?.ownerKey ?? null, open, sync, close }),
    [content?.ownerKey, open, sync, close],
  )

  return (
    <DiagramViewerContext.Provider value={value}>
      {children}
      <ViewerOverlay content={content?.node ?? null} onClose={close} />
    </DiagramViewerContext.Provider>
  )
}

export function useDiagramViewer(): DiagramViewerContextValue {
  return useContext(DiagramViewerContext)
}
