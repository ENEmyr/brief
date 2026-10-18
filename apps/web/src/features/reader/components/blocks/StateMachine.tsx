'use client'
import { useMemo, useState } from 'react'
import type { Block, Tone } from '@brief/schema'
import { BlockCard, cardHeader } from '../BlockCard'
import type { BlockAnchor } from '../blockAnchor'
import { useDiagramFullScreen } from '../fullScreen'
import { estimateTextWidth, wrapText } from '../../lib/svgText'
import { DiagramFooter, Edge, EDGE_TONE, EdgeLayer, type EdgeTone, type Point } from './diagramParts'

type StateBlock = Extract<Block, { type: 'state' }>
type Transition = StateBlock['transitions'][number]

/** B-Blocks2:36-40: 160x56 nodes, 256 apart in a row and 160 apart in a column. */
const NODE_WIDTH = 160
const NODE_MIN_HEIGHT = 56
const NODE_PAD = 6
const COL_GAP = 96
const ROW_GAP = 104
const LINE = 16
const NODE_FONT_SIZE = 13
const EDGE_FONT_SIZE = 12
/** Edge labels sit 12px off their edge (B-Blocks2:41, :44). */
const LABEL_GAP = 12
const TIP_GAP = 1
/** A transition to itself has the seq self-message's loop, 26 wide and 16 high (seqLayout.ts). */
const SELF_LOOP = { width: 26, height: 16 }
const PAD = 24
/** B-Blocks2:30-37: the top row starts 72 into the 330 canvas; the bottom row ends 42 above its foot. */
const PAD_TOP = 72
const PAD_BOTTOM = 42

interface Cell {
  col: number
  row: number
}

/**
 * Lays the machine out along its main path: from `initial`, the first new
 * target of a state continues the row to the right, and every other new
 * target goes under its source, as B-Blocks2:36-37 puts the 429 branch under
 * "received". States the walk never reaches get a row of their own.
 */
function layoutStates(
  states: StateBlock['states'],
  transitions: readonly Transition[],
  initial: string,
): Map<string, Cell> {
  const ids = new Set(states.map((s) => s.id))
  const targets = new Map<string, string[]>()
  for (const t of transitions) targets.set(t.from, [...(targets.get(t.from) ?? []), t.to])

  const cells = new Map<string, Cell>()
  const taken = new Set<string>()
  const free = (col: number, fromRow: number) => {
    let row = fromRow
    while (taken.has(`${col}:${row}`)) row += 1
    return row
  }
  const place = (id: string, col: number, row: number) => {
    cells.set(id, { col, row })
    taken.add(`${col}:${row}`)
  }

  const walk = (id: string) => {
    const at = cells.get(id)
    if (!at) return
    let continued = false
    for (const next of targets.get(id) ?? []) {
      if (cells.has(next) || !ids.has(next)) continue
      if (!continued) {
        place(next, at.col + 1, free(at.col + 1, at.row))
        continued = true
      } else {
        place(next, at.col, free(at.col, at.row + 1))
      }
      walk(next)
    }
  }

  if (ids.has(initial)) {
    place(initial, 0, 0)
    walk(initial)
  }
  for (const s of states) {
    if (cells.has(s.id)) continue
    const row = Math.max(-1, ...[...cells.values()].map((c) => c.row)) + 1
    place(s.id, 0, row)
    walk(s.id)
  }
  return cells
}

interface NodeBox {
  id: string
  label: string
  lines: string[]
  x: number
  y: number
  initial: boolean
  final: boolean
  tone?: Tone
}

interface EdgeShape {
  from: string
  to: string
  points: Point[]
  tone: EdgeTone
  dashed: boolean
  label?: { lines: string[]; left: number; top: number; width: number; align: 'center' | 'left' | 'right' }
}

interface StateLayout {
  width: number
  height: number
  nodeHeight: number
  nodes: NodeBox[]
  edges: EdgeShape[]
}

function computeStateLayout(block: StateBlock, transitions: Transition[]): StateLayout {
  const cells = layoutStates(block.states, transitions, block.initial)
  const outgoing = new Set(transitions.map((t) => t.from))
  const finals = new Set(block.states.filter((s) => !outgoing.has(s.id)).map((s) => s.id))

  const wrapped = block.states.map((s) => wrapText(s.label, NODE_WIDTH - 2 * NODE_PAD, NODE_FONT_SIZE))
  const tagged = block.states.map((s) => s.id === block.initial || finals.has(s.id))
  const nodeHeight = Math.max(
    NODE_MIN_HEIGHT,
    ...wrapped.map((lines, i) => (lines.length + (tagged[i] ? 1 : 0)) * LINE + 2 * NODE_PAD),
  )

  // A row's gap grows with its widest label, so a long transition label never
  // runs into the next node.
  const horizontalLabels = transitions.map((t) => {
    const a = cells.get(t.from)
    const b = cells.get(t.to)
    return a && b && a.row === b.row && t.label ? estimateTextWidth(t.label, EDGE_FONT_SIZE) : 0
  })
  const colGap = Math.max(COL_GAP, Math.min(240, Math.max(0, ...horizontalLabels) + 2 * LABEL_GAP))
  const colPitch = NODE_WIDTH + colGap
  const rowPitch = nodeHeight + ROW_GAP

  const nodes: NodeBox[] = block.states.map((s, i) => {
    const cell = cells.get(s.id) ?? { col: 0, row: 0 }
    return {
      id: s.id,
      label: s.label,
      lines: wrapped[i] ?? [s.label],
      x: cell.col * colPitch,
      y: cell.row * rowPitch,
      initial: s.id === block.initial,
      final: finals.has(s.id),
      tone: s.tone,
    }
  })
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const pairCount = new Map<string, number>()
  for (const t of transitions) {
    const key = [t.from, t.to].sort().join('\u0000')
    pairCount.set(key, (pairCount.get(key) ?? 0) + 1)
  }

  const edges: EdgeShape[] = transitions.flatMap((t): EdgeShape[] => {
    const a = byId.get(t.from)
    const b = byId.get(t.to)
    const ca = cells.get(t.from)
    const cb = cells.get(t.to)
    if (!a || !b || !ca || !cb) return []
    const back = a === b || cb.col < ca.col || (cb.col === ca.col && cb.row < ca.row)
    const tone: EdgeTone = t.tone ?? (back ? 'warn' : b.final ? 'good' : 'sub')
    const paired = (pairCount.get([t.from, t.to].sort().join('\u0000')) ?? 0) > 1
    const vertical = ca.col === cb.col && ca.row !== cb.row
    const room = vertical ? NODE_WIDTH - 2 * LABEL_GAP : colGap - 2 * LABEL_GAP
    const lines = t.label ? wrapText(t.label, room, EDGE_FONT_SIZE) : []
    const width = Math.ceil(Math.max(0, ...lines.map((l) => estimateTextWidth(l, EDGE_FONT_SIZE))))
    const above = (cx: number, y: number): EdgeShape['label'] =>
      lines.length ? { lines, left: cx - width / 2, top: y - LABEL_GAP - lines.length * LINE, width, align: 'center' } : undefined
    const below = (cx: number, y: number): EdgeShape['label'] =>
      lines.length ? { lines, left: cx - width / 2, top: y + LABEL_GAP / 2, width, align: 'center' } : undefined
    const base = { from: t.from, to: t.to, tone, dashed: back }
    const centerY = a.y + nodeHeight / 2

    // A transition to itself loops over the node's right third, a loop back like any other.
    if (a === b) {
      const x1 = a.x + (2 * NODE_WIDTH) / 3 + SELF_LOOP.width / 2
      const x2 = x1 - SELF_LOOP.width
      const y = a.y - SELF_LOOP.height
      const points = [
        { x: x1, y: a.y },
        { x: x1, y },
        { x: x2, y },
        { x: x2, y: a.y - TIP_GAP },
      ]
      return [{ ...base, points, label: above((x1 + x2) / 2, y) }]
    }

    // Neighbours in a row: a straight edge; a pair in both directions splits
    // above and below the center line.
    if (ca.row === cb.row && Math.abs(cb.col - ca.col) === 1) {
      const right = cb.col > ca.col
      const y = centerY + (paired ? (back ? 8 : -8) : 0)
      const x1 = right ? a.x + NODE_WIDTH : a.x
      const x2 = right ? b.x - TIP_GAP : b.x + NODE_WIDTH + TIP_GAP
      const points = [
        { x: x1, y },
        { x: x2, y },
      ]
      return [{ ...base, points, label: paired && back ? below((x1 + x2) / 2, y) : above((x1 + x2) / 2, y) }]
    }

    // Farther along the same row: under the row, so it never crosses a node.
    if (ca.row === cb.row) {
      const y = a.y + nodeHeight + 2 * LABEL_GAP
      const ax = a.x + NODE_WIDTH / 2
      const bx = b.x + NODE_WIDTH / 2
      const points = [
        { x: ax, y: a.y + nodeHeight },
        { x: ax, y },
        { x: bx, y },
        { x: bx, y: b.y + nodeHeight + TIP_GAP },
      ]
      return [{ ...base, points, label: below((ax + bx) / 2, y) }]
    }

    const down = cb.row > ca.row
    const yTip = down ? b.y - TIP_GAP : b.y + nodeHeight + TIP_GAP

    // One column: vertical, a pair at a third and two thirds of the node
    // (B-Blocks2:34-35), each label on its own side (B-Blocks2:44-45).
    if (ca.col === cb.col) {
      const x = a.x + (paired ? (down ? NODE_WIDTH / 3 : (2 * NODE_WIDTH) / 3) : NODE_WIDTH / 2)
      const points = [
        { x, y: down ? a.y + nodeHeight : a.y },
        { x, y: yTip },
      ]
      const midY = down ? (a.y + nodeHeight + b.y) / 2 : (b.y + nodeHeight + a.y) / 2
      const onLeft = paired && down
      const label: EdgeShape['label'] = lines.length
        ? {
            lines,
            left: onLeft ? x - LABEL_GAP - width : x + LABEL_GAP,
            top: midY - (lines.length * LINE) / 2,
            width,
            align: onLeft ? 'right' : 'left',
          }
        : undefined
      return [{ ...base, points, label }]
    }

    // Elsewhere: out of the side, then down or up into the target.
    const right = cb.col > ca.col
    const x1 = right ? a.x + NODE_WIDTH : a.x
    const bx = b.x + NODE_WIDTH / 2
    const points = [
      { x: x1, y: centerY },
      { x: bx, y: centerY },
      { x: bx, y: yTip },
    ]
    return [{ ...base, points, label: above((x1 + bx) / 2, centerY) }]
  })

  // Shift everything so the leftmost label or node sits PAD from the side and
  // the highest one PAD_TOP from the top.
  const lefts = [...nodes.map((n) => n.x), ...edges.flatMap((e) => (e.label ? [e.label.left] : []))]
  const tops = [...nodes.map((n) => n.y), ...edges.flatMap((e) => (e.label ? [e.label.top] : []))]
  const rights = [
    ...nodes.map((n) => n.x + NODE_WIDTH),
    ...edges.flatMap((e) => (e.label ? [e.label.left + e.label.width] : [])),
  ]
  const bottoms = [
    ...nodes.map((n) => n.y + nodeHeight),
    ...edges.flatMap((e) => (e.label ? [e.label.top + e.label.lines.length * LINE] : [])),
  ]
  const dx = PAD - Math.min(...lefts)
  const dy = PAD_TOP - Math.min(...tops)
  const move = (p: Point) => ({ x: p.x + dx, y: p.y + dy })

  return {
    width: Math.ceil(Math.max(...rights) + dx + PAD),
    height: Math.ceil(Math.max(...bottoms) + dy + PAD_BOTTOM),
    nodeHeight,
    nodes: nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy })),
    edges: edges.map((e) => ({
      ...e,
      points: e.points.map(move),
      label: e.label && { ...e.label, left: e.label.left + dx, top: e.label.top + dy },
    })),
  }
}

const LABEL_TONE: Record<EdgeTone, string> = {
  sub: 'text-sub',
  faint: 'text-faint',
  line2: 'text-line2',
  accent: 'text-accent-text',
  info: 'text-info',
  good: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
}

/**
 * A toned state fills with the tone's soft color and borders with its line
 * color (B-Blocks2:37, the 429 state); a final state keeps its double border
 * in the tone's strong color (B-Blocks2:40, final in good).
 */
const NODE_TONE: Record<Tone, { fill: string; line: string; strong: string; tag: string }> = {
  info: { fill: 'bg-info-soft', line: 'border-info-line', strong: 'border-info', tag: 'text-info' },
  good: { fill: 'bg-good-soft', line: 'border-good-line', strong: 'border-good', tag: 'text-good' },
  warn: { fill: 'bg-warn-soft', line: 'border-warn-line', strong: 'border-warn', tag: 'text-warn' },
  bad: { fill: 'bg-bad-soft', line: 'border-bad-line', strong: 'border-bad', tag: 'text-bad' },
}

/** Initial is lime, final double and good, the rest plain; a tone recolors the frame, not its shape. */
function nodeFrame(n: NodeBox): string {
  const tone = n.tone && NODE_TONE[n.tone]
  if (n.final) return `border-[3px] border-double ${tone ? `${tone.strong} ${tone.fill}` : 'border-good bg-good-soft'}`
  if (n.initial) return `border-2 border-accent-line ${tone ? tone.fill : 'bg-elev'}`
  return tone ? `border ${tone.line} ${tone.fill}` : 'border border-line2 bg-elev'
}

function tagClass(n: NodeBox): string {
  if (!n.final) return 'text-accent-text'
  return n.tone ? NODE_TONE[n.tone].tag : 'text-good'
}

/** Dimmed by hover (B-Blocks2:48); the disabled-control opacity (components.md:29). */
const DIM = 'opacity-45'

/**
 * State machine diagram block (B-Blocks2:27-49). The initial state has a lime
 * border, a final state (one with no outgoing transition) a double green
 * border, and a transition back to an earlier state is a dashed amber loop.
 * Hovering a state dims everything not connected to it.
 *
 * Transitions referencing an unknown state id are dropped defensively.
 */
export function StateMachine({ block, ...anchor }: { block: StateBlock } & BlockAnchor) {
  const [hovered, setHovered] = useState<string | null>(null)

  const transitions = useMemo(() => {
    const ids = new Set(block.states.map((s) => s.id))
    return block.transitions.filter((t) => ids.has(t.from) && ids.has(t.to))
  }, [block.states, block.transitions])
  const layout = useMemo(() => computeStateLayout(block, transitions), [block, transitions])

  const connected = useMemo(() => {
    if (hovered === null) return null
    const ids = new Set([hovered])
    for (const t of transitions) {
      if (t.from === hovered) ids.add(t.to)
      if (t.to === hovered) ids.add(t.from)
    }
    return ids
  }, [hovered, transitions])
  const dimNode = (id: string) => (connected && !connected.has(id) ? DIM : '')
  const dimEdge = (e: EdgeShape) => (hovered !== null && e.from !== hovered && e.to !== hovered ? DIM : '')
  const fade = 'transition-opacity duration-[var(--dur-base)] motion-reduce:transition-none'

  const diagram = (
    <div
      className="relative mx-auto text-[13px] leading-4"
      style={{ width: layout.width, height: layout.height }}
    >
      <EdgeLayer width={layout.width} height={layout.height}>
        {layout.edges.map((e, i) => (
          <Edge
            key={i}
            points={e.points}
            dashed={e.dashed}
            className={`${EDGE_TONE[e.tone]} ${fade} ${dimEdge(e)}`}
          />
        ))}
      </EdgeLayer>
      {layout.nodes.map((n, i) => (
        <div
          key={i}
          data-state-node={n.id}
          onPointerEnter={() => setHovered(n.id)}
          onPointerLeave={() => setHovered(null)}
          data-tone={n.tone}
          className={`absolute box-border flex items-center justify-center rounded-[6px] p-1.5 text-center text-text ${fade} ${dimNode(n.id)} ${nodeFrame(n)}`}
          style={{ left: n.x, top: n.y, width: NODE_WIDTH, height: layout.nodeHeight }}
        >
          <span>
            {n.lines.map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
            {n.initial || n.final ? (
              <span className={`block font-mono text-[10px] ${tagClass(n)}`}>
                {n.final ? 'final' : 'initial'}
              </span>
            ) : null}
          </span>
        </div>
      ))}
      {layout.edges.map((e, i) =>
        e.label ? (
          <div
            key={i}
            className={`absolute whitespace-pre text-[12px] ${e.label.align === 'center' ? 'text-center font-mono' : e.label.align === 'right' ? 'text-right' : ''} ${LABEL_TONE[e.tone]} ${fade} ${dimEdge(e)}`}
            style={{ left: e.label.left, top: e.label.top, width: e.label.width }}
          >
            {e.label.lines.join('\n')}
          </div>
        ) : null,
      )}
    </div>
  )
  const onFullScreen = useDiagramFullScreen(diagram, { heading: { kind: block.type, title: block.title } })
  const states = block.states.length

  return (
    <BlockCard
      {...cardHeader(block, anchor)}
      captionSuffix={`${states} ${states === 1 ? 'state' : 'states'} / ${transitions.length} ${
        transitions.length === 1 ? 'transition' : 'transitions'
      }`}
      fullScreen={onFullScreen}
    >
      <div className="overflow-x-auto py-3">{diagram}</div>
      <DiagramFooter>
        <span>
          <b>Hover a state</b> dims everything not connected to it.
        </span>
        <span>
          <b>Initial</b> lime border. <b>Final</b> double border.
        </span>
        <span>
          <b>Loop back</b> dashed.
        </span>
      </DiagramFooter>
    </BlockCard>
  )
}
