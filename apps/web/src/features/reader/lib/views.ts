import type { Block, Section } from '@brief/schema'

export type ReaderView = 'document' | 'diagrams' | 'raw'

/** B-Reader's view tabs. */
export const VIEW_TABS: ReadonlyArray<{ id: ReaderView; label: string }> = [
  { id: 'document', label: 'Document' },
  { id: 'diagrams', label: 'Diagrams' },
  { id: 'raw', label: 'Raw' },
]

/** What the Diagrams view keeps: the diagram blocks and the chart blocks. */
export const DIAGRAM_BLOCK_TYPES: ReadonlySet<Block['type']> = new Set([
  'seq',
  'state',
  'layers',
  'erd',
  'mermaid',
  'bigo',
  'heatmap',
  'histogram',
  'scatter',
  'plot3d',
])

export function hasDiagrams(sections: Section[]): boolean {
  return sections.some((s) => s.blocks.some((b) => DIAGRAM_BLOCK_TYPES.has(b.type)))
}
