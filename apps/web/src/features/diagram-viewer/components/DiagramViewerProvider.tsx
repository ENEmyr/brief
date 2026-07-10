'use client'
import { createContext, useContext } from 'react'
import { useViewer } from '../hooks/useViewer'
import { ViewerOverlay } from './ViewerOverlay'

export interface DiagramViewerContextValue {
  open: (html: string) => void
  close: () => void
}

// A no-op default so any consumer calling useDiagramViewer() outside a
// DiagramViewerProvider (e.g. a block component under a bare unit test)
// gets a harmless open()/close() instead of a crash. This lets tests for
// individual blocks skip wrapping every render in a provider.
const noop = () => {}
const defaultValue: DiagramViewerContextValue = { open: noop, close: noop }

const DiagramViewerContext = createContext<DiagramViewerContextValue>(defaultValue)

/**
 * Owns the single fullscreen diagram viewer for its subtree: holds the
 * useViewer() open/closed state and renders one ViewerOverlay after
 * `children`, so any descendant can call useDiagramViewer().open(html) to
 * expand a diagram without each block needing its own overlay instance.
 */
export function DiagramViewerProvider({ children }: { children: React.ReactNode }) {
  const { content, open, close } = useViewer()

  return (
    <DiagramViewerContext.Provider value={{ open, close }}>
      {children}
      <ViewerOverlay content={content} onClose={close} />
    </DiagramViewerContext.Provider>
  )
}

export function useDiagramViewer(): DiagramViewerContextValue {
  return useContext(DiagramViewerContext)
}
