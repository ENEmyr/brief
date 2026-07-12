import type { Highlight, ReaderState } from './store'

/**
 * Reader state arrives from localStorage and from KV, and both were previously
 * cast to the state type without being checked. That was survivable while the
 * shape never changed; it is not, now that a highlight carries a leaf path and a
 * nullable block index. A stored value from an older build, a hand-edited blob,
 * or a half-written entry would otherwise flow straight into the renderer.
 *
 * Anything that does not typecheck at runtime is dropped rather than repaired:
 * a highlight we cannot place is not one we can honestly paint.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function coerceHighlight(raw: unknown): Highlight | null {
  if (!isRecord(raw)) return null
  const { id, sid, bid, path, start, end, text, note, question } = raw

  if (typeof id !== 'string' || id === '') return null
  if (typeof sid !== 'number' || !Number.isInteger(sid)) return null
  // bid is absent/null for a section heading, which is not a block.
  const bidOk = bid === null || bid === undefined || Number.isInteger(bid)
  if (!bidOk) return null
  if (typeof start !== 'number' || typeof end !== 'number') return null
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) return null
  if (typeof text !== 'string') return null
  if (note !== null && typeof note !== 'string') return null
  if (question !== undefined && typeof question !== 'string') return null
  if (path !== undefined && typeof path !== 'string') return null

  const highlight: Highlight = {
    id,
    sid,
    bid: typeof bid === 'number' ? bid : null,
    start,
    end,
    text,
    note: note === null ? null : (note as string),
    ...(path === undefined ? {} : { path }),
    ...(question === undefined ? {} : { question: question as string }),
  }
  return highlight
}

export function coerceHighlights(raw: unknown): Highlight[] {
  if (!Array.isArray(raw)) return []
  return raw.map(coerceHighlight).filter((h): h is Highlight => h !== null)
}

export function coerceState(raw: unknown): ReaderState {
  const value = isRecord(raw) ? raw : {}
  return {
    highlights: coerceHighlights(value.highlights),
    dsel: isRecord(value.dsel) ? (value.dsel as ReaderState['dsel']) : {},
    dnote: isRecord(value.dnote) ? (value.dnote as ReaderState['dnote']) : {},
  }
}
