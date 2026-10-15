'use client'
import { useMemo } from 'react'
import type { Block } from '@brief/schema'
import { BlockCard, cardHeader } from '../BlockCard'
import type { BlockAnchor } from '../blockAnchor'
import { useDiagramFullScreen } from '../fullScreen'
import { estimateTextWidth, wrapText } from '../../lib/svgText'
import { Edge, EDGE_TONE, EdgeLayer, type Point } from './diagramParts'

type LayersBlock = Extract<Block, { type: 'layers' }>

/** B-Blocks2:55-70: 120px bands 150 apart, 180x52 nodes 300 apart, the first at 220. */
const BAND_HEIGHT = 120
const BAND_PITCH = 150
const NODE_WIDTH = 180
const NODE_MIN_HEIGHT = 52
const NODE_TOP = 34
const COL_PITCH = 300
const FIRST_COL = 220
const RIGHT_MARGIN = 40
const MIN_WIDTH = 1040
const LINE = 16
const NODE_PAD = 6
const LABEL_GAP = 12
const TIP_GAP = 1
/** A vertical edge runs down the middle of the empty strip between two columns. */
const CHANNEL = COL_PITCH - NODE_WIDTH

interface NodeBox {
  id: string
  label: string
  lines: string[]
  band: number
  col: number
  x: number
  y: number
  /**
   * The id of this node in a diff block's map. Its badge (M or new) needs that
   * diff node's status (B-Blocks2:77), and no diff block exists before round 2,
   * so the link is only marked on the node.
   */
  diffNode?: string
}

interface EdgeShape {
  points: Point[]
  label?: { lines: string[]; left: number; top: number; width: number; centered: boolean }
}

interface LayersLayout {
  width: number
  height: number
  nodeHeight: number
  bandHeight: number
  bands: { label: string; top: number }[]
  nodes: NodeBox[]
  edges: EdgeShape[]
}

function computeLayersLayout(block: LayersBlock): LayersLayout {
  const seen = new Set<string>()
  const placed: Omit<NodeBox, 'x' | 'y'>[] = []
  block.layers.forEach((layer, band) => {
    let col = 0
    for (const node of layer.nodes) {
      if (seen.has(node.id)) continue
      seen.add(node.id)
      placed.push({
        id: node.id,
        label: node.label,
        lines: wrapText(node.label, NODE_WIDTH - 2 * NODE_PAD, 13),
        band,
        col,
        diffNode: node.diffNode,
      })
      col += 1
    }
  })
  const nodeHeight = Math.max(NODE_MIN_HEIGHT, ...placed.map((n) => n.lines.length * LINE + 2 * NODE_PAD))
  const nodeTop = NODE_TOP
  const bandHeight = Math.max(BAND_HEIGHT, nodeTop + nodeHeight + NODE_TOP)
  const bandPitch = bandHeight + (BAND_PITCH - BAND_HEIGHT)
  const nodes: NodeBox[] = placed.map((n) => ({
    ...n,
    x: FIRST_COL + n.col * COL_PITCH,
    y: n.band * bandPitch + nodeTop,
  }))
  const byId = new Map(nodes.map((n) => [n.id, n]))

  const columns = Math.max(1, ...nodes.map((n) => n.col + 1))
  const width = Math.max(MIN_WIDTH, FIRST_COL + columns * COL_PITCH - CHANNEL + RIGHT_MARGIN)
  const gapBelow = (band: number) => band * bandPitch + bandHeight + (bandPitch - bandHeight) / 2

  const edges: EdgeShape[] = block.layers.flatMap((layer) =>
    layer.edges.flatMap((edge): EdgeShape[] => {
      const a = byId.get(edge.from)
      const b = byId.get(edge.to)
      if (!a || !b || a === b) return []
      const lines = edge.label ? wrapText(edge.label, CHANNEL - LABEL_GAP, 12) : []
      const labelWidth = Math.ceil(Math.max(0, ...lines.map((l) => estimateTextWidth(l, 12))))
      const cy = (n: NodeBox) => n.y + nodeHeight / 2
      const cx = (n: NodeBox) => n.x + NODE_WIDTH / 2

      // Neighbours in one band: straight across, label above (B-Blocks2:61, :71).
      if (a.band === b.band && Math.abs(a.col - b.col) === 1) {
        const right = b.col > a.col
        const x1 = right ? a.x + NODE_WIDTH : a.x
        const x2 = right ? b.x - TIP_GAP : b.x + NODE_WIDTH + TIP_GAP
        return [
          {
            points: [
              { x: x1, y: cy(a) },
              { x: x2, y: cy(a) },
            ],
            label: lines.length
              ? { lines, left: (x1 + x2) / 2 - labelWidth / 2, top: cy(a) - LABEL_GAP - lines.length * LINE, width: labelWidth, centered: true }
              : undefined,
          },
        ]
      }

      // Farther along one band: under the nodes, inside the band.
      if (a.band === b.band) {
        const y = a.y + nodeHeight + (bandHeight - nodeTop - nodeHeight) / 2
        return [
          {
            points: [
              { x: cx(a), y: a.y + nodeHeight },
              { x: cx(a), y },
              { x: cx(b), y },
              { x: cx(b), y: b.y + nodeHeight + TIP_GAP },
            ],
          },
        ]
      }

      // Across bands: leave through the gap next to the source band, run down an
      // empty strip between columns, and enter the target from the gap next to
      // its band, so no edge crosses a node (B-Blocks2:62-64 draw the same
      // shape for neighbours: down, across, in).
      const down = b.band > a.band
      const exitY = down ? a.y + nodeHeight : a.y
      const enterY = down ? b.y - TIP_GAP : b.y + nodeHeight + TIP_GAP
      const gapA = down ? gapBelow(a.band) : gapBelow(a.band - 1)
      const gapB = down ? gapBelow(b.band - 1) : gapBelow(b.band)
      const points: Point[] = [{ x: cx(a), y: exitY }]
      if (Math.abs(b.band - a.band) === 1) {
        points.push({ x: cx(a), y: gapA }, { x: cx(b), y: gapA })
      } else {
        const mid = (cx(a) + cx(b)) / 2
        const channel = Array.from({ length: columns + 1 }, (_, k) => FIRST_COL - CHANNEL / 2 + k * COL_PITCH).reduce(
          (best, x) => (Math.abs(x - mid) < Math.abs(best - mid) ? x : best),
        )
        points.push({ x: cx(a), y: gapA }, { x: channel, y: gapA }, { x: channel, y: gapB }, { x: cx(b), y: gapB })
      }
      points.push({ x: cx(b), y: enterY })
      const strip = down ? (gapB + b.y) / 2 : (gapB + b.y + nodeHeight) / 2
      return [
        {
          points: points.filter((p, i) => i === 0 || p.x !== points[i - 1]?.x || p.y !== points[i - 1]?.y),
          label: lines.length
            ? { lines, left: cx(b) + LABEL_GAP, top: strip - (lines.length * LINE) / 2, width: labelWidth, centered: false }
            : undefined,
        },
      ]
    }),
  )

  return {
    width,
    height: (block.layers.length - 1) * bandPitch + bandHeight,
    nodeHeight,
    bandHeight,
    bands: block.layers.map((layer, i) => ({ label: layer.label, top: i * bandPitch })),
    nodes,
    edges,
  }
}

/**
 * Layers diagram block (B-Blocks2:51-78): one band per layer, label top left in
 * mono caps, every layer shown at once. Nodes repeated in a later layer keep
 * their first position; edges to an id no layer defines are dropped.
 */
export function Layers({ block, ...anchor }: { block: LayersBlock } & BlockAnchor) {
  const layout = useMemo(() => computeLayersLayout(block), [block])

  const diagram = (
    <div className="relative mx-auto text-[13px] leading-4" style={{ width: layout.width, height: layout.height }}>
      {layout.bands.map((band, i) => (
        <div
          key={i}
          data-band=""
          className="absolute left-0 box-border rounded-[4px] border border-[var(--c-grid-line)] bg-[var(--c-code-bg)]"
          style={{ top: band.top, width: layout.width, height: layout.bandHeight }}
        >
          <span className="absolute left-4 top-3 font-mono text-[11px] uppercase leading-[normal] tracking-[.06em] text-faint">
            {band.label}
          </span>
        </div>
      ))}
      <EdgeLayer width={layout.width} height={layout.height}>
        {layout.edges.map((e, i) => (
          <Edge key={i} points={e.points} className={EDGE_TONE.sub} />
        ))}
      </EdgeLayer>
      {layout.nodes.map((n) => (
        <div
          key={n.id}
          data-layer-node={n.id}
          data-diff-node={n.diffNode}
          className="absolute box-border flex items-center justify-center rounded-[6px] border border-line2 bg-elev p-1.5 text-center text-text"
          style={{ left: n.x, top: n.y, width: NODE_WIDTH, height: layout.nodeHeight }}
        >
          <span>
            {n.lines.map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </span>
        </div>
      ))}
      {layout.edges.map((e, i) =>
        e.label ? (
          <div
            key={i}
            className={`absolute whitespace-pre font-mono text-[12px] text-sub ${e.label.centered ? 'text-center' : ''}`}
            style={{ left: e.label.left, top: e.label.top, width: e.label.width }}
          >
            {e.label.lines.join('\n')}
          </div>
        ) : null,
      )}
    </div>
  )
  const onFullScreen = useDiagramFullScreen(diagram, { heading: { kind: block.type, title: block.title } })
  const layers = block.layers.length
  const nodes = layout.nodes.length

  return (
    <BlockCard
      {...cardHeader(block, anchor)}
      captionSuffix={`${layers} ${layers === 1 ? 'layer' : 'layers'} / ${nodes} ${nodes === 1 ? 'node' : 'nodes'}`}
      fullScreen={onFullScreen}
    >
      <div className="overflow-x-auto p-4">{diagram}</div>
    </BlockCard>
  )
}
