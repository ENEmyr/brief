import type { FlowNodeKind, Tone, WalkthroughBlock } from '@brief/schema'
import { wrapText } from './svgText'

/** A run of code lines that one step claims, or no step. Captions follow the run. */
export interface CodeSegment {
  owner: number | null
  /** 0-based, end exclusive. */
  start: number
  end: number
  /** Steps whose last claimed line ends this run. */
  captions: number[]
}

export interface FlowBox {
  id: string
  label: string
  kind: FlowNodeKind
  tone?: Tone
  x: number
  y: number
  w: number
  h: number
}

export interface FlowEdge {
  from: string
  to: string
  label?: string
  tone?: Tone
  points: { x: number; y: number }[]
  /** Where the label's box starts; it sits 12px off the edge's first segment. */
  labelAt?: { x: number; y: number; align: 'left' | 'center' }
}

export interface WalkthroughModel {
  lines: string[]
  segments: CodeSegment[]
  /** Steps that claim no line (all taken, or past the end); their captions close the listing. */
  unplaced: number[]
  /** revealed[i]: every node id steps 0..i reveal. */
  revealed: Set<string>[]
  boxes: Map<string, FlowBox>
  edges: FlowEdge[]
  width: number
  height: number
}

/** B-NewBlocks:85-104: 220 wide nodes; 48 high stadiums, 56 high boxes, a 200x96 diamond. */
const NODE_WIDTH = 220
/** B-NewBlocks:109: a node in a side column is 170 wide and starts at its column's left edge. */
const SIDE_WIDTH = 170
const SIZE: Record<FlowNodeKind, { w: number; h: number }> = {
  start: { w: 220, h: 48 },
  end: { w: 220, h: 48 },
  step: { w: 220, h: 56 },
  decision: { w: 200, h: 96 },
}
/** B-NewBlocks:85-104: rows 40 apart, 64 when a label rides the edge; a side branch 300 to the right. */
const ROW_GAP = 40
const LABELLED_ROW_GAP = 64
const COL_PITCH = 300
const NODE_PAD = 8
const NODE_LINE = 18
const PAD_Y = 24
/** B-NewBlocks:101, :112: the main column starts at left 60; the canvas ends 10 past the side node (540 wide). */
const PAD_LEFT = 60
const PAD_RIGHT = 10
const LABEL_GAP = 12
const LABEL_HEIGHT = 16
const DETOUR = 20

/** A long label grows its node instead of being clipped; a diamond's text fits its middle half. */
function nodeSize(label: string, kind: FlowNodeKind, side: boolean): { w: number; h: number } {
  const { h } = SIZE[kind]
  const w = side && kind !== 'decision' ? SIDE_WIDTH : SIZE[kind].w
  const room = kind === 'decision' ? w / 2 : w - 2 * NODE_PAD
  const lines = wrapText(label, room, kind === 'start' || kind === 'end' ? 13 : 12).length
  const needed = lines * NODE_LINE + 2 * NODE_PAD
  return { w, h: Math.max(h, kind === 'decision' ? 2 * needed : needed) }
}

function claimLines(block: WalkthroughBlock, count: number) {
  const owner: (number | null)[] = Array.from({ length: count }, () => null)
  block.steps.forEach((step, i) => {
    const last = Math.min(Math.max(step.to ?? step.from, step.from), count)
    for (let line = step.from; line <= last; line += 1) {
      if (owner[line - 1] === null) owner[line - 1] = i
    }
  })
  return owner
}

function segmentLines(owner: (number | null)[], stepCount: number) {
  const lastLine = new Map<number, number>()
  owner.forEach((o, i) => {
    if (o !== null) lastLine.set(o, i)
  })
  const segments: CodeSegment[] = []
  owner.forEach((o, i) => {
    const open = segments[segments.length - 1]
    if (open && open.owner === o && open.captions.length === 0) open.end = i + 1
    else segments.push({ owner: o, start: i, end: i + 1, captions: [] })
    if (o !== null && lastLine.get(o) === i) segments[segments.length - 1]!.captions.push(o)
  })
  const unplaced = Array.from({ length: stepCount }, (_, i) => i).filter((i) => !lastLine.has(i))
  return { segments, unplaced }
}

/**
 * Lays the flow out down the page: from the start node, a node's first new
 * target continues its column a row lower, and every other new target opens a
 * column to the right on the same row, as B-NewBlocks:96-97 puts "429" beside
 * the decision. The target with the longer path below it continues the column.
 * Nodes the walk never reaches get rows of their own at the bottom.
 */
function layoutFlow(block: WalkthroughBlock) {
  const nodes = new Map(block.flow.nodes.map((n) => [n.id, n]))
  const edges = block.flow.edges.filter((e) => nodes.has(e.from) && nodes.has(e.to))
  const targets = new Map<string, string[]>()
  for (const e of edges) targets.set(e.from, [...(targets.get(e.from) ?? []), e.to])

  const depthMemo = new Map<string, number>()
  const depth = (id: string, seen: Set<string>): number => {
    const known = depthMemo.get(id)
    if (known !== undefined) return known
    if (seen.has(id)) return 0
    seen.add(id)
    const below = (targets.get(id) ?? []).map((t) => depth(t, seen))
    seen.delete(id)
    const d = 1 + Math.max(0, ...below)
    depthMemo.set(id, d)
    return d
  }

  const cells = new Map<string, { col: number; row: number }>()
  const taken = new Set<string>()
  let nextCol = 0
  const place = (id: string, col: number, row: number) => {
    let r = row
    while (taken.has(`${col}:${r}`)) r += 1
    cells.set(id, { col, row: r })
    taken.add(`${col}:${r}`)
    nextCol = Math.max(nextCol, col + 1)
    return r
  }
  const walk = (id: string) => {
    const at = cells.get(id)!
    const fresh = [...new Set(targets.get(id) ?? [])]
      .filter((t) => !cells.has(t))
      .map((t, order) => ({ t, order, d: depth(t, new Set()) }))
      .sort((a, b) => b.d - a.d || b.order - a.order)
    fresh.forEach(({ t }, i) => {
      if (cells.has(t)) return
      if (i === 0) place(t, at.col, at.row + 1)
      else place(t, nextCol, at.row)
    })
    for (const { t } of fresh) walk(t)
  }

  const first = block.flow.nodes.find((n) => n.kind === 'start') ?? block.flow.nodes[0]!
  place(first.id, 0, 0)
  walk(first.id)
  for (const n of block.flow.nodes) {
    if (cells.has(n.id)) continue
    const bottom = Math.max(...[...cells.values()].map((c) => c.row)) + 1
    place(n.id, 0, bottom)
    walk(n.id)
  }

  const rowCount = Math.max(...[...cells.values()].map((c) => c.row)) + 1
  const rowHeight = Array.from({ length: rowCount }, () => 0)
  const sizes = new Map(block.flow.nodes.map((n) => [n.id, nodeSize(n.label, n.kind ?? 'step', cells.get(n.id)!.col > 0)]))
  for (const [id, c] of cells) rowHeight[c.row] = Math.max(rowHeight[c.row]!, sizes.get(id)!.h)
  const labelled = new Set(
    edges.filter((e) => e.label !== undefined && cells.get(e.from)!.row !== cells.get(e.to)!.row).map((e) => cells.get(e.to)!.row),
  )
  const rowTop: number[] = []
  let y = PAD_Y
  for (let r = 0; r < rowCount; r += 1) {
    if (r > 0) y += labelled.has(r) ? LABELLED_ROW_GAP : ROW_GAP
    rowTop.push(y)
    y += rowHeight[r]!
  }

  const boxes = new Map<string, FlowBox>()
  // Payload order, so the nodes read in the order the agent wrote them.
  for (const { id } of block.flow.nodes) {
    const c = cells.get(id)!
    const node = nodes.get(id)!
    const kind = node.kind ?? 'step'
    const { w, h } = sizes.get(id)!
    boxes.set(id, {
      id,
      label: node.label,
      kind,
      tone: node.tone,
      x: PAD_LEFT + c.col * COL_PITCH + (c.col === 0 || kind === 'decision' ? (NODE_WIDTH - w) / 2 : 0),
      y: rowTop[c.row]! + (rowHeight[c.row]! - h) / 2,
      w,
      h,
    })
  }

  let maxX = Math.max(...[...boxes.values()].map((b) => b.x + b.w))
  const flowEdges = edges.map((e): FlowEdge => {
    const s = boxes.get(e.from)!
    const t = boxes.get(e.to)!
    const sc = cells.get(e.from)!
    const tc = cells.get(e.to)!
    const scx = s.x + s.w / 2
    const tcx = t.x + t.w / 2
    const scy = s.y + s.h / 2
    const tcy = t.y + t.h / 2
    let points: { x: number; y: number }[]
    if (tc.row > sc.row && tc.col === sc.col) {
      points = [{ x: scx, y: s.y + s.h }, { x: tcx, y: t.y }]
    } else if (tc.row > sc.row) {
      const mid = t.y - ROW_GAP / 2
      points = [{ x: scx, y: s.y + s.h }, { x: scx, y: mid }, { x: tcx, y: mid }, { x: tcx, y: t.y }]
    } else if (tc.row === sc.row && tc.col > sc.col) {
      points = [{ x: s.x + s.w, y: scy }, { x: t.x, y: tcy }]
    } else if (tc.row === sc.row && tc.col < sc.col) {
      points = [{ x: s.x, y: scy }, { x: t.x + t.w, y: tcy }]
    } else {
      const x = Math.max(s.x + s.w, t.x + t.w) + DETOUR
      maxX = Math.max(maxX, x)
      points = [{ x: s.x + s.w, y: scy }, { x, y: scy }, { x, y: tcy }, { x: t.x + t.w, y: tcy }]
    }
    if (e.label === undefined) return { from: e.from, to: e.to, tone: e.tone, points }
    const [a, b] = points as [{ x: number; y: number }, { x: number; y: number }]
    const labelAt =
      a.x === b.x
        ? { x: a.x + LABEL_GAP, y: (a.y + b.y) / 2 - LABEL_HEIGHT / 2, align: 'left' as const }
        : { x: (a.x + b.x) / 2, y: a.y - LABEL_GAP - LABEL_HEIGHT, align: 'center' as const }
    return { from: e.from, to: e.to, label: e.label, tone: e.tone, points, labelAt }
  })

  return { boxes, edges: flowEdges, width: maxX + PAD_RIGHT, height: y + PAD_Y }
}

/**
 * Resolves a walkthrough once. A step's lines are clamped to the listing and
 * the first step to claim a line keeps it; a node id, an edge end or a step
 * reference that the flow lacks is dropped here, so the render never meets one.
 */
export function walkthroughModel(block: WalkthroughBlock): WalkthroughModel {
  const lines = block.code.split('\n')
  const { segments, unplaced } = segmentLines(claimLines(block, lines.length), block.steps.length)
  const ids = new Set(block.flow.nodes.map((n) => n.id))
  const revealed: Set<string>[] = []
  let shown = new Set<string>()
  for (const step of block.steps) {
    shown = new Set([...shown, ...step.nodes.filter((id) => ids.has(id))])
    revealed.push(shown)
  }
  return { lines, segments, unplaced, revealed, ...layoutFlow(block) }
}
