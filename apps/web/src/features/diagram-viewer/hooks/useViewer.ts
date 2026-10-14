'use client'
import { useCallback, useState } from 'react'

/** The header of the viewer (B-Overlays:148): the block's kind tag and its title. */
export interface ViewerHeading {
  kind: string
  title?: string
}

/**
 * Step mode (B-Overlays:149, :167). The owning block keeps the step; the
 * viewer only shows it and asks for the next one. A missing handler disables
 * its button.
 */
export interface ViewerSteps {
  /** "3 / 6" */
  label: string
  /** Read to screen readers on every step. */
  text: string
  onPrev?: () => void
  onNext?: () => void
}

export interface ViewerExtras {
  heading?: ViewerHeading
  steps?: ViewerSteps
}

export interface ViewerContent extends ViewerExtras {
  /** Identifies the block that opened the viewer, so that block (and only that
   *  block) can keep the expanded copy in step with its own re-renders. */
  ownerKey: string
  node: React.ReactNode
}

export interface UseViewerResult {
  content: ViewerContent | null
  open: (ownerKey: string, node: React.ReactNode, extras?: ViewerExtras) => void
  /** Refresh the expanded copy, but only if `ownerKey` still owns the viewer.
   *  A stale card whose expand was superseded must not overwrite the new one. */
  sync: (ownerKey: string, node: React.ReactNode, extras?: ViewerExtras) => void
  close: () => void
}

/**
 * Owns the fullscreen diagram viewer's open/closed state.
 *
 * The expanded diagram is a live React node, not a serialized outerHTML
 * snapshot. Serializing froze any interactive diagram (a Seq's current step)
 * at whatever it showed when it was opened, and forced the markup back through
 * an HTML sink on every open. Holding the node means the owning block
 * re-renders the expanded copy along with its own state, and there is no HTML
 * sink left to sanitize.
 */
export function useViewer(): UseViewerResult {
  const [content, setContent] = useState<ViewerContent | null>(null)

  const open = useCallback((ownerKey: string, node: React.ReactNode, extras?: ViewerExtras) => {
    setContent({ ownerKey, node, ...extras })
  }, [])

  const sync = useCallback((ownerKey: string, node: React.ReactNode, extras?: ViewerExtras) => {
    setContent((prev) => (prev?.ownerKey === ownerKey ? { ownerKey, node, ...extras } : prev))
  }, [])

  const close = useCallback(() => setContent(null), [])

  return { content, open, sync, close }
}
