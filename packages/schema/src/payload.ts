import { z } from 'zod'

export const MAX_PAYLOAD_BYTES = 1_900_000

export const BLOCK_TYPES = [
  'p', 'note', 'warn', 'good', 'table', 'compare', 'stat', 'coverage', 'details',
  'seq', 'state', 'layers', 'ba', 'bigo', 'code', 'mermaid', 'math', 'erd',
  'heatmap', 'histogram', 'scatter', 'plot3d', 'list', 'walkthrough', 'diff', 'trajectory',
  'image',
] as const

/** Semantic tones; each maps to the --c-<tone>, -soft and -line tokens. */
export const TONES = ['info', 'good', 'warn', 'bad'] as const
export const STAT_TONES = ['mauve', 'blue', 'green', 'red', 'peach', 'teal', 'yellow'] as const
export const ALIGNS = ['left', 'center', 'right'] as const
export const BA_SIDES = ['before', 'after'] as const
export const FLOW_NODE_KINDS = ['start', 'step', 'decision', 'end'] as const
export const DIFF_FILE_STATUSES = ['added', 'modified', 'deleted', 'renamed'] as const
export const DIFF_CHANGE_KINDS = ['added', 'modified', 'removed', 'moved', 'config'] as const
export const DIFF_MAP_STATUSES = ['added', 'modified', 'deleted'] as const
export const TRAJECTORY_KINDS = ['request', 'read', 'run', 'edit', 'decision', 'assumption', 'note'] as const

const text = z.string().min(1)
const label = z.string().min(1).max(300)
const short = z.string().min(1).max(40)
const position = z.number().int().min(1)
const tone = z.enum(TONES)
const statTone = z.enum(STAT_TONES)

const codeNote = z.object({ from: position, to: position.optional(), text: z.string().min(1).max(280) })
const baNote = codeNote.extend({ side: z.enum(BA_SIDES) })

const pBlock = z.object({ type: z.literal('p'), text })
const noteBlock = z.object({ type: z.literal('note'), text, title: label.optional() })
const warnBlock = z.object({ type: z.literal('warn'), text, title: label.optional() })
const goodBlock = z.object({ type: z.literal('good'), text, title: label.optional() })

const tableBlock = z.object({
  type: z.literal('table'),
  head: z.array(label).min(1),
  rows: z.array(z.array(z.string())).min(1),
  caption: label.optional(),
  align: z.array(z.enum(ALIGNS)).max(50).optional(),
  cells: z.array(z.object({ row: position, col: position, tone })).max(200).optional(),
})

const compareSide = z.object({
  title: label,
  tone: z.enum(['good', 'bad']).optional(),
  tag: label.optional(),
  items: z.array(z.object({ text, ok: z.boolean() })).min(1),
})
const compareBlock = z.object({
  type: z.literal('compare'),
  caption: label.optional(),
  left: compareSide,
  right: compareSide,
})

const statBlock = z.object({
  type: z.literal('stat'),
  caption: label.optional(),
  items: z.array(z.object({
    label,
    value: z.string(),
    hint: z.string().optional(),
    tone: statTone.optional(),
    hintTone: statTone.optional(),
    spark: z.array(z.number().min(0)).min(2).max(32).optional(),
  })).min(1),
})

const coverageBlock = z.object({
  type: z.literal('coverage'),
  caption: label.optional(),
  items: z.array(z.object({ label, status: z.enum(['full', 'partial', 'missing']), note: z.string().optional() })).min(1),
})

const seqBlock = z.object({
  type: z.literal('seq'),
  title: label.optional(),
  actors: z.array(label).min(2),
  steps: z.array(z.object({ from: label, to: label, label: z.string(), note: z.string().optional(), text: label.optional() })).min(1),
})

const stateBlock = z.object({
  type: z.literal('state'),
  title: label.optional(),
  initial: label,
  states: z.array(z.object({ id: label, label, tone: tone.optional() })).min(1),
  transitions: z.array(z.object({ from: label, to: label, label: z.string().optional(), tone: tone.optional() })),
})

const layersBlock = z.object({
  type: z.literal('layers'),
  title: label.optional(),
  layers: z.array(z.object({
    id: label,
    label,
    nodes: z.array(z.object({ id: label, label, diffNode: label.optional() })).min(1),
    edges: z.array(z.object({ from: label, to: label, label: z.string().optional() })),
  })).min(1),
})

const baBlock = z.object({
  type: z.literal('ba'),
  language: label,
  before: z.string(),
  after: z.string(),
  titleBefore: label.optional(),
  titleAfter: label.optional(),
  filename: label.optional(),
  notes: z.array(baNote).max(30).optional(),
})

export const BIGO_CURVES = ['1', 'logn', 'sqrt', 'n', 'nlogn', 'n2', 'n3', '2n'] as const
const bigoBlock = z.object({
  type: z.literal('bigo'),
  title: label.optional(),
  series: z.array(z.object({ label, curve: z.enum(BIGO_CURVES) })).min(1),
  maxN: z.number().int().min(10).max(1_000_000).optional(),
})

const codeBlock = z.object({
  type: z.literal('code'),
  language: label,
  code: z.string(),
  filename: label.optional(),
  highlight: z.array(z.number().int().min(1)).optional(),
  notes: z.array(codeNote).max(30).optional(),
})

const mermaidBlock = z.object({ type: z.literal('mermaid'), code: z.string().min(1), title: label.optional() })
const mathBlock = z.object({ type: z.literal('math'), latex: z.string().min(1), title: label.optional() })

const erdBlock = z.object({
  type: z.literal('erd'),
  title: label.optional(),
  tables: z.array(z.object({
    name: label,
    columns: z.array(z.object({
      name: label,
      type: label,
      pk: z.boolean().optional(),
      fk: z.object({ table: label, column: label }).optional(),
    })).min(1),
  })).min(1),
})

const heatmapBlock = z.object({
  type: z.literal('heatmap'),
  title: label.optional(),
  xLabels: z.array(label).min(1),
  yLabels: z.array(label).min(1),
  values: z.array(z.array(z.number())).min(1),
})

const histogramBlock = z.object({
  type: z.literal('histogram'),
  title: label.optional(),
  bins: z.array(z.object({ label, count: z.number() })).min(1),
  threshold: z.object({ bin: position, label: short, value: short.optional() }).optional(),
})

const scatterBlock = z.object({
  type: z.literal('scatter'),
  title: label.optional(),
  xLabel: label.optional(),
  yLabel: label.optional(),
  series: z.array(z.object({ label, points: z.array(z.tuple([z.number(), z.number()])).min(1) })).min(1),
})

const plot3dBlock = z.object({
  type: z.literal('plot3d'),
  title: label.optional(),
  kind: z.enum(['scatter3d', 'surface']),
  points: z.array(z.tuple([z.number(), z.number(), z.number()])).optional(),
  grid: z.array(z.array(z.number())).optional(),
  xLabel: label.optional(),
  yLabel: label.optional(),
  zLabel: label.optional(),
})

const listBlock = z.object({
  type: z.literal('list'),
  ordered: z.boolean().optional(),
  caption: label.optional(),
  items: z.array(z.string().min(1).max(500)).min(1).max(100),
})

const flowNode = z.object({ id: label, label, kind: z.enum(FLOW_NODE_KINDS).optional(), tone: tone.optional() })
const flowEdge = z.object({ from: label, to: label, label: label.optional(), tone: tone.optional() })

const walkthroughBlock = z.object({
  type: z.literal('walkthrough'),
  language: label,
  filename: label.optional(),
  title: label.optional(),
  code: z.string().min(1).max(20_000),
  flow: z.object({ nodes: z.array(flowNode).min(2).max(40), edges: z.array(flowEdge).max(80) }),
  steps: z.array(z.object({
    from: position,
    to: position.optional(),
    title: label,
    nodes: z.array(label).min(1).max(40),
  })).min(1).max(40),
})

const diffChange = z.object({
  symbol: label,
  change: z.enum(DIFF_CHANGE_KINDS),
  summary: z.string().min(1).max(280),
  steps: z.array(label).max(8).optional(),
})

const diffBlock = z.object({
  type: z.literal('diff'),
  files: z.array(z.object({
    path: label,
    status: z.enum(DIFF_FILE_STATUSES),
    from: label.optional(),
    patch: z.string().max(50_000).optional(),
    folded: z.boolean().optional(),
    changes: z.array(diffChange).max(30).optional(),
  })).min(1).max(50),
  map: z.object({
    nodes: z.array(z.object({ id: label, label, status: z.enum(DIFF_MAP_STATUSES).optional() })).min(1).max(40),
    edges: z.array(z.object({ from: label, to: label })).max(80),
  }).optional(),
})

const count = z.number().int().min(0)

/** Each step carries its own UTC time; the reader shows it as time since the first step. */
const trajectoryBlock = z.object({
  type: z.literal('trajectory'),
  steps: z.array(z.object({
    at: z.iso.datetime(),
    kind: z.enum(TRAJECTORY_KINDS),
    title: label,
    detail: z.string().min(1).max(400).optional(),
    flag: z.boolean().optional(),
  })).min(1).max(200),
  stats: z.object({ seconds: count.optional(), tokens: count.optional() }).optional(),
})

/** An id the image API issued. The charset leaves no room for a URL, a path or inline data. */
export const IMAGE_ID_PATTERN = /^[\w-]{8,64}$/
const pixels = z.number().int().min(1).max(10_000)

const imageBlock = z.object({
  type: z.literal('image'),
  imageId: z.string().regex(IMAGE_ID_PATTERN),
  alt: label,
  caption: label.optional(),
  width: pixels.optional(),
  height: pixels.optional(),
})

const nonRecursiveBlock = z.discriminatedUnion('type', [
  pBlock, noteBlock, warnBlock, goodBlock, tableBlock, compareBlock, statBlock,
  coverageBlock, seqBlock, stateBlock, layersBlock, baBlock, bigoBlock, codeBlock,
  mermaidBlock, mathBlock, erdBlock, heatmapBlock, histogramBlock, scatterBlock, plot3dBlock,
  listBlock,
  walkthroughBlock, diffBlock, trajectoryBlock, imageBlock,
])

const detailsBlock = z.object({
  type: z.literal('details'),
  summary: label,
  blocks: z.array(nonRecursiveBlock).min(1),
})

export const blockSchema = z.union([nonRecursiveBlock, detailsBlock])

export const sectionSchema = z.object({
  id: label,
  no: z.number().int().min(1),
  title: label,
  blocks: z.array(blockSchema).min(1),
})

export const decisionSchema = z.object({
  id: label,
  q: text,
  multi: z.boolean(),
  opts: z.array(z.object({ id: label, label, detail: z.string().optional() })).min(2),
  why: z.string().optional(),
  cmp: tableBlock.omit({ type: true }).optional(),
  dia: z.string().optional(),
  refs: z.array(label).max(6).optional(),
})

export const metaSchema = z.object({
  title: label,
  author: label.optional(),
  role: label.optional(),
  date: z.string().optional(),
  version: label.optional(),
  repo: z.string().optional(),
  readTime: label.optional(),
  docId: label.optional(),
  subtitle: label.optional(),
})

export const glossaryEntrySchema = z.object({
  term: label,
  def: z.string().min(1).max(400),
  aliases: z.array(label).max(5).optional(),
})

export const payloadSchema = z.object({
  meta: metaSchema,
  sections: z.array(sectionSchema).min(1),
  decisions: z.array(decisionSchema),
  glossary: z.array(glossaryEntrySchema).max(60).optional(),
})

export type Payload = z.infer<typeof payloadSchema>
export type Section = z.infer<typeof sectionSchema>
export type Block = z.infer<typeof blockSchema>
export type Decision = z.infer<typeof decisionSchema>
export type Meta = z.infer<typeof metaSchema>
export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>
export type Tone = (typeof TONES)[number]
export type StatTone = (typeof STAT_TONES)[number]
export type Align = (typeof ALIGNS)[number]
export type CodeNote = z.infer<typeof codeNote>
export type BaNote = z.infer<typeof baNote>
export type ListBlock = z.infer<typeof listBlock>
export type TableCell = NonNullable<z.infer<typeof tableBlock>['cells']>[number]
export type HistogramThreshold = NonNullable<z.infer<typeof histogramBlock>['threshold']>
export type FlowNodeKind = (typeof FLOW_NODE_KINDS)[number]
export type WalkthroughBlock = z.infer<typeof walkthroughBlock>
export type DiffBlock = z.infer<typeof diffBlock>
export type DiffChange = z.infer<typeof diffChange>
export type TrajectoryBlock = z.infer<typeof trajectoryBlock>
export type ImageBlock = z.infer<typeof imageBlock>

/** A stored block the deployed schema cannot read (a type from a newer or
 * rolled-back schema, or a shape a cap now rejects), kept verbatim. */
export interface UnreadableBlock {
  type: 'unreadable'
  raw: unknown
}
type NonRecursiveBlock = z.infer<typeof nonRecursiveBlock>
type DetailsBlock = z.infer<typeof detailsBlock>
export type StoredDetailsBlock = Omit<DetailsBlock, 'blocks'> & { blocks: (NonRecursiveBlock | UnreadableBlock)[] }
export type StoredBlock = Exclude<Block, DetailsBlock> | StoredDetailsBlock | UnreadableBlock
export type StoredSection = Omit<Section, 'blocks'> & { blocks: StoredBlock[] }
export type StoredPayload = Omit<Payload, 'sections'> & { sections: StoredSection[] }

const looseDetailsSchema = detailsBlock.extend({ blocks: z.array(z.unknown()).min(1) })
const storedPayloadSchema = payloadSchema.extend({
  sections: z.array(sectionSchema.extend({ blocks: z.array(z.unknown()).min(1) })).min(1),
})

function readNestedBlock(raw: unknown): NonRecursiveBlock | UnreadableBlock {
  const parsed = nonRecursiveBlock.safeParse(raw)
  return parsed.success ? parsed.data : { type: 'unreadable', raw }
}

function readBlock(raw: unknown): StoredBlock {
  const parsed = blockSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  const details = looseDetailsSchema.safeParse(raw)
  if (details.success) return { ...details.data, blocks: details.data.blocks.map(readNestedBlock) }
  return { type: 'unreadable', raw }
}

/**
 * Parses a payload read back from storage. Unlike `payloadSchema`, a block the
 * schema rejects becomes an `UnreadableBlock` instead of failing the whole
 * document. Anything outside the blocks must still parse; that throws.
 */
export function parseStoredPayload(data: unknown): StoredPayload {
  const loose = storedPayloadSchema.parse(data)
  return { ...loose, sections: loose.sections.map((s) => ({ ...s, blocks: s.blocks.map(readBlock) })) }
}
