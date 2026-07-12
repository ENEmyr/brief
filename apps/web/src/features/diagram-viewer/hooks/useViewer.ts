'use client'
import { useCallback, useState } from 'react'

export interface ViewerContent {
  /** Identifies the block that opened the viewer, so that block (and only that
   *  block) can keep the expanded copy in step with its own re-renders. */
  ownerKey: string
  node: React.ReactNode
}

export interface UseViewerResult {
  content: ViewerContent | null
  open: (ownerKey: string, node: React.ReactNode) => void
  /** Refresh the expanded copy, but only if `ownerKey` still owns the viewer.
   *  A stale card whose expand was superseded must not overwrite the new one. */
  sync: (ownerKey: string, node: React.ReactNode) => void
  close: () => void
}

/**
 * Owns the fullscreen diagram viewer's open/closed state.
 *
 * The expanded diagram is a live React node, not a serialized outerHTML
 * snapshot. Serializing froze any interactive diagram (a Seq's current step, a
 * StateMachine's current state) at whatever it showed when Expand was pressed,
 * and forced the markup back through an HTML sink on every open. Holding the
 * node means the owning block re-renders the expanded copy along with its own
 * state, and there is no HTML sink left to sanitize.
 */
export function useViewer(): UseViewerResult {
  const [content, setContent] = useState<ViewerContent | null>(null)

  const open = useCallback((ownerKey: string, node: React.ReactNode) => {
    setContent({ ownerKey, node })
  }, [])

  const sync = useCallback((ownerKey: string, node: React.ReactNode) => {
    setContent((prev) => (prev?.ownerKey === ownerKey ? { ownerKey, node } : prev))
  }, [])

  const close = useCallback(() => setContent(null), [])

  return { content, open, sync, close }
}
