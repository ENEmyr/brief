/** Offset from a node's auto-laid-out position, in diagram (viewBox) units. */
export type NodeOffset = { dx: number; dy: number }
/** node name -> offset, for one diagram block. */
export type BlockLayout = Record<string, NodeOffset>
/** `${sid}:${bid}` -> that block's moved nodes. */
export type DiagramLayout = Record<string, BlockLayout>

/**
 * Diagram layout is deliberately NOT part of reader-state.
 *
 * Reader-state is one opaque blob PUT to KV with last-writer-wins semantics and
 * shared by every reader of a link. Dragging a node emits writes, so syncing
 * layout would let one reader rearranging furniture clobber another reader's
 * highlights and decision answers mid-flight. Highlights are collaborative
 * content and belong there; where you happen to like the boxes is a personal
 * presentational preference and belongs here, in this reader's browser only.
 */
function storageKey(sessionId: string): string {
  return `idocs:layout:${sessionId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function coerceOffset(raw: unknown): NodeOffset | null {
  if (!isRecord(raw)) return null
  const { dx, dy } = raw
  if (typeof dx !== 'number' || typeof dy !== 'number') return null
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null
  return { dx, dy }
}

function coerceLayout(raw: unknown): DiagramLayout {
  if (!isRecord(raw)) return {}
  const layout: DiagramLayout = {}
  for (const [blockKey, blockRaw] of Object.entries(raw)) {
    if (!isRecord(blockRaw)) continue
    const block: BlockLayout = {}
    for (const [node, offsetRaw] of Object.entries(blockRaw)) {
      const offset = coerceOffset(offsetRaw)
      if (offset) block[node] = offset
    }
    if (Object.keys(block).length > 0) layout[blockKey] = block
  }
  return layout
}

/** Never throws: returns {} when nothing is stored, storage is unavailable
 *  (SSR, private mode), or the stored value is corrupt. */
export function loadLayout(sessionId: string): DiagramLayout {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId))
    return raw === null ? {} : coerceLayout(JSON.parse(raw))
  } catch {
    return {}
  }
}

export function saveLayout(sessionId: string, layout: DiagramLayout): void {
  if (typeof window === 'undefined') return
  try {
    if (Object.keys(layout).length === 0) {
      window.localStorage.removeItem(storageKey(sessionId))
      return
    }
    window.localStorage.setItem(storageKey(sessionId), JSON.stringify(layout))
  } catch {
    // Storage full or blocked. Layout is a nicety; never break the reader.
  }
}
