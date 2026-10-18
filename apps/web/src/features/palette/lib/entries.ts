import type { Block, StoredBlock, StoredPayload } from '@brief/schema'

export type PaletteEntry =
  | { kind: 'decision'; key: string; decisionId: string; label: string; keywords: string }
  | { kind: 'block'; key: string; tag: string; label: string; sectionId: string; sectionNo: number }
  | { kind: 'section'; key: string; sectionId: string; sectionNo: number; label: string }
  | { kind: 'action'; key: string; label: string; run: () => void }

export interface PaletteGroup {
  kind: PaletteEntry['kind']
  title: string
  entries: PaletteEntry[]
}

export const pad = (n: number) => String(n).padStart(2, '0')

type BlockOf<T extends Block['type']> = Extract<Block, { type: T }>

/**
 * The strings a reader can see in each block type, in reading order. Every
 * type needs a row, so a new block type fails typecheck here until someone
 * decides what the palette should find in it.
 */
const BLOCK_STRINGS: { [T in Block['type']]: (block: BlockOf<T>) => (string | undefined)[] } = {
  p: (b) => [b.text],
  note: (b) => [b.title, b.text],
  warn: (b) => [b.title, b.text],
  good: (b) => [b.title, b.text],
  table: (b) => [b.caption, b.head.join(' '), ...b.rows.map((row) => row.join(' '))],
  compare: (b) => [
    b.caption,
    ...[b.left, b.right].flatMap((side) => [side.title, ...side.items.map((item) => item.text)]),
  ],
  stat: (b) => [b.caption, ...b.items.map((item) => `${item.label} ${item.value}`)],
  coverage: (b) => [b.caption, ...b.items.map((item) => item.label)],
  details: (b) => [b.summary, ...b.blocks.flatMap(blockStrings)],
  seq: (b) => [b.title, ...b.steps.map((step) => step.label)],
  code: (b) => [b.filename, ...b.code.split('\n')],
  state: (b) => [b.title],
  layers: (b) => [b.title],
  ba: (b) => [b.filename],
  bigo: (b) => [b.title],
  mermaid: (b) => [b.title],
  math: (b) => [b.title],
  erd: (b) => [b.title],
  heatmap: (b) => [b.title],
  histogram: (b) => [b.title],
  scatter: (b) => [b.title],
  plot3d: (b) => [b.title],
  list: (b) => [b.caption, ...b.items],
  walkthrough: (b) => [b.filename, b.title, ...b.code.split('\n'), ...b.steps.map((step) => step.title)],
  diff: (b) => b.files.flatMap((file) => [file.path, ...(file.changes ?? []).map((change) => `${change.symbol} ${change.summary}`)]),
  trajectory: (b) => b.steps.flatMap((step) => [step.title, step.detail]),
  image: (b) => [b.caption],
}

function blockStrings(block: StoredBlock): string[] {
  if (block.type === 'unreadable') return []
  const extract = BLOCK_STRINGS[block.type] as (block: StoredBlock) => (string | undefined)[]
  return extract(block).flatMap((text) => {
    const label = text?.trim()
    return label ? [label] : []
  })
}

/** Sections, blocks and decisions of a payload (no actions; the shell adds those). */
export function buildDocumentEntries(payload: StoredPayload): PaletteEntry[] {
  const decisions = payload.decisions.map(
    (decision): PaletteEntry => ({
      kind: 'decision',
      key: `d:${decision.id}`,
      decisionId: decision.id,
      label: decision.q,
      keywords: [decision.id, ...decision.opts.map((opt) => opt.label)].join(' '),
    }),
  )
  const reading = payload.sections.flatMap((section, sectionIndex): PaletteEntry[] => [
    { kind: 'section', key: `s:${section.id}`, sectionId: section.id, sectionNo: section.no, label: section.title },
    ...section.blocks.flatMap((block, blockIndex) =>
      blockStrings(block).map(
        (label, n): PaletteEntry => ({
          kind: 'block',
          key: `b:${sectionIndex}:${blockIndex}:${n}`,
          tag: block.type,
          label,
          sectionId: section.id,
          sectionNo: section.no,
        }),
      ),
    ),
  ])
  return [...decisions, ...reading]
}

/**
 * Display order and rules per group. Blocks stay out of the empty-query list
 * and are capped, since a one-letter query can match hundreds of code lines.
 */
const GROUPS: { kind: PaletteEntry['kind']; title: string; listedWhenEmpty: boolean; cap: number }[] = [
  { kind: 'decision', title: 'DECISIONS', listedWhenEmpty: true, cap: Infinity },
  { kind: 'block', title: 'BLOCKS', listedWhenEmpty: false, cap: 50 },
  { kind: 'section', title: 'SECTIONS', listedWhenEmpty: true, cap: Infinity },
  { kind: 'action', title: 'ACTIONS', listedWhenEmpty: true, cap: Infinity },
]

function searchableText(entry: PaletteEntry): string[] {
  switch (entry.kind) {
    case 'decision':
      return [entry.label, entry.keywords]
    case 'section':
      return [entry.label, pad(entry.sectionNo)]
    case 'block':
    case 'action':
      return [entry.label]
  }
}

/**
 * Groups in this order: Decisions, Blocks, Sections, Actions. Empty groups dropped.
 * Empty (or whitespace) query: Decisions, Sections and Actions only (no Blocks).
 * Non-empty query: case-insensitive substring match (toLocaleLowerCase, works for Thai).
 */
export function filterEntries(entries: PaletteEntry[], query: string): PaletteGroup[] {
  const needle = query.trim().toLocaleLowerCase()
  const matches = (entry: PaletteEntry) =>
    searchableText(entry).some((text) => text.toLocaleLowerCase().includes(needle))

  return GROUPS.flatMap(({ kind, title, listedWhenEmpty, cap }) => {
    if (!needle && !listedWhenEmpty) return []
    const found = entries.filter((entry) => entry.kind === kind && (!needle || matches(entry)))
    return found.length > 0 ? [{ kind, title, entries: found.slice(0, cap) }] : []
  })
}
