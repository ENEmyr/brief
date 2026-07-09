import { z } from 'zod'

export const MAX_PAYLOAD_BYTES = 1_900_000

export const BLOCK_TYPES = [
  'p', 'note', 'warn', 'good', 'table', 'compare', 'stat', 'coverage', 'details',
  'seq', 'state', 'layers', 'ba', 'bigo', 'code', 'mermaid', 'math', 'erd',
  'heatmap', 'histogram', 'scatter', 'plot3d',
] as const

const text = z.string().min(1)
const label = z.string().min(1).max(300)

const pBlock = z.object({ type: z.literal('p'), text })
const noteBlock = z.object({ type: z.literal('note'), text, title: label.optional() })
const warnBlock = z.object({ type: z.literal('warn'), text, title: label.optional() })
const goodBlock = z.object({ type: z.literal('good'), text, title: label.optional() })

const tableBlock = z.object({
  type: z.literal('table'),
  head: z.array(label).min(1),
  rows: z.array(z.array(z.string())).min(1),
  caption: label.optional(),
})

const compareSide = z.object({ title: label, items: z.array(z.object({ text, ok: z.boolean() })).min(1) })
const compareBlock = z.object({ type: z.literal('compare'), left: compareSide, right: compareSide })

const statBlock = z.object({
  type: z.literal('stat'),
  items: z.array(z.object({ label, value: z.string(), hint: z.string().optional() })).min(1),
})

const coverageBlock = z.object({
  type: z.literal('coverage'),
  items: z.array(z.object({ label, status: z.enum(['full', 'partial', 'missing']), note: z.string().optional() })).min(1),
})

const seqBlock = z.object({
  type: z.literal('seq'),
  title: label.optional(),
  actors: z.array(label).min(2),
  steps: z.array(z.object({ from: label, to: label, label: z.string(), note: z.string().optional() })).min(1),
})

const stateBlock = z.object({
  type: z.literal('state'),
  title: label.optional(),
  initial: label,
  states: z.array(z.object({ id: label, label })).min(1),
  transitions: z.array(z.object({ from: label, to: label, label: z.string().optional() })),
})

const layersBlock = z.object({
  type: z.literal('layers'),
  title: label.optional(),
  layers: z.array(z.object({
    id: label,
    label,
    nodes: z.array(z.object({ id: label, label })).min(1),
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

const nonRecursiveBlock = z.discriminatedUnion('type', [
  pBlock, noteBlock, warnBlock, goodBlock, tableBlock, compareBlock, statBlock,
  coverageBlock, seqBlock, stateBlock, layersBlock, baBlock, bigoBlock, codeBlock,
  mermaidBlock, mathBlock, erdBlock, heatmapBlock, histogramBlock, scatterBlock, plot3dBlock,
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
})

export const metaSchema = z.object({
  title: label,
  author: label.optional(),
  role: label.optional(),
  date: z.string().optional(),
  version: label.optional(),
  repo: z.string().optional(),
  readTime: label.optional(),
})

export const payloadSchema = z.object({
  meta: metaSchema,
  sections: z.array(sectionSchema).min(1),
  decisions: z.array(decisionSchema),
})

export type Payload = z.infer<typeof payloadSchema>
export type Section = z.infer<typeof sectionSchema>
export type Block = z.infer<typeof blockSchema>
export type Decision = z.infer<typeof decisionSchema>
export type Meta = z.infer<typeof metaSchema>
