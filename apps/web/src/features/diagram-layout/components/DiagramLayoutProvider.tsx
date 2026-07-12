'use client'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { loadLayout, saveLayout } from '../persistence'
import type { BlockLayout, DiagramLayout, NodeOffset } from '../persistence'

export interface DiagramLayoutContextValue {
  layout: DiagramLayout
  setNodeOffset: (blockKey: string, node: string, offset: NodeOffset) => void
  resetBlock: (blockKey: string) => void
}

const noop = () => {}
const defaultValue: DiagramLayoutContextValue = {
  layout: {},
  setNodeOffset: noop,
  resetBlock: noop,
}

const DiagramLayoutContext = createContext<DiagramLayoutContextValue>(defaultValue)

/**
 * Holds where this reader dragged each diagram node, for one session.
 *
 * Offsets are deltas from the auto-layout position, never absolute coordinates.
 * A republished payload that adds or renames a table then reflows normally and
 * the surviving deltas still apply, whereas absolute coordinates would freeze a
 * stale layout the moment the auto-layout output changed.
 */
export function DiagramLayoutProvider({
  sessionId,
  children,
}: {
  sessionId: string
  children: React.ReactNode
}) {
  const [layout, setLayout] = useState<DiagramLayout>(() => loadLayout(sessionId))

  const setNodeOffset = useCallback(
    (blockKey: string, node: string, offset: NodeOffset) => {
      setLayout((prev) => {
        const block: BlockLayout = { ...prev[blockKey], [node]: offset }
        const next: DiagramLayout = { ...prev, [blockKey]: block }
        saveLayout(sessionId, next)
        return next
      })
    },
    [sessionId],
  )

  const resetBlock = useCallback(
    (blockKey: string) => {
      setLayout((prev) => {
        if (!prev[blockKey]) return prev
        const next = { ...prev }
        delete next[blockKey]
        saveLayout(sessionId, next)
        return next
      })
    },
    [sessionId],
  )

  const value = useMemo(
    () => ({ layout, setNodeOffset, resetBlock }),
    [layout, setNodeOffset, resetBlock],
  )

  return <DiagramLayoutContext.Provider value={value}>{children}</DiagramLayoutContext.Provider>
}

/**
 * Node offsets for one diagram block. `knownNodes` prunes offsets left behind
 * by a node the payload no longer has, so a renamed or removed table cannot
 * keep dragging a ghost around.
 */
export function useBlockLayout(blockKey: string, knownNodes: readonly string[]) {
  const { layout, setNodeOffset, resetBlock } = useContext(DiagramLayoutContext)

  const offsets = useMemo(() => {
    const stored = layout[blockKey]
    if (!stored) return {}
    const pruned: BlockLayout = {}
    for (const node of knownNodes) {
      const offset = stored[node]
      if (offset) pruned[node] = offset
    }
    return pruned
    // knownNodes is rebuilt each render by callers; key on its content.
  }, [layout, blockKey, knownNodes])

  const moved = Object.keys(offsets).length > 0

  const moveNode = useCallback(
    (node: string, offset: NodeOffset) => setNodeOffset(blockKey, node, offset),
    [setNodeOffset, blockKey],
  )

  const reset = useCallback(() => resetBlock(blockKey), [resetBlock, blockKey])

  return { offsets, moved, moveNode, reset }
}
