import type { Decision, StoredSection } from '@brief/schema'

/** A section a decision points the reader to (D7), as its context chip shows it. */
export interface ResolvedRef {
  id: string
  no: number
  title: string
}

/**
 * The sections `decision.refs` names, in ref order. An id with no section is
 * dropped, and so is a repeat, so a chip always lands somewhere and once.
 */
export function resolveRefs(decision: Decision, sections: readonly StoredSection[]): ResolvedRef[] {
  const seen = new Set<string>()
  return (decision.refs ?? []).flatMap((id) => {
    const section = sections.find((s) => s.id === id)
    if (!section || seen.has(id)) return []
    seen.add(id)
    return [{ id, no: section.no, title: section.title }]
  })
}
