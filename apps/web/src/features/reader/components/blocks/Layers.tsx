'use client'
import { useId, useMemo, useState } from 'react'
import type { Block } from '@brief/schema'
import { DiagramCard } from '../DiagramCard'
import { titleCaption } from '../blockAnchor'
import type { BlockAnchor } from '../blockAnchor'
import { svgTextStyle } from '../../lib/svgText'

type LayersBlock = Extract<Block, { type: 'layers' }>
type LayerDef = LayersBlock['layers'][number]

// Layer 0 (base) is always blue; further layers cycle the rest of this list.
// teal/peach lands on layers 1/2 to match the prototype's cache=teal,
// retry=peach fixed mock (Reader.dc.html 625-641) when a payload happens to
// have exactly that shape, but any number of layers cycles cleanly.
const LAYER_COLOR_NAMES = ['blue', 'teal', 'peach', 'green', 'mauve'] as const

const NODE_HEIGHT = 34
const START_X = 20
const NODE_GAP_X = 40
const BASE_ROW_Y = 58
const FIRST_ABOVE_Y = 10
const FIRST_BELOW_Y = 108
const ROW_STACK_STEP = 48

interface NodeInfo {
  label: string
  x: number
  y: number
  w: number
  h: number
  layerIndex: number
}

interface OwnedEdge {
  from: string
  to: string
  label: string | undefined
  layerIndex: number
}

interface Layout {
  nodes: Map<string, NodeInfo>
  edges: OwnedEdge[]
  width: number
  minY: number
  maxY: number
}

function nodeWidth(label: string): number {
  return Math.max(72, label.length * 7 + 24)
}

/**
 * Row y-coordinate per layer index: layer 0 is the base row (center); every
 * later layer alternates above/below the base, stacking further out by
 * ROW_STACK_STEP each time it revisits a side. Matches the brief's row
 * layout spec and the prototype's cache-above/retry-below placement.
 */
function rowYFor(layerIndex: number, aboveCount: number, belowCount: number): number {
  if (layerIndex === 0) return BASE_ROW_Y
  return layerIndex % 2 === 1 ? FIRST_ABOVE_Y - aboveCount * ROW_STACK_STEP : FIRST_BELOW_Y + belowCount * ROW_STACK_STEP
}

/**
 * Lays out the union of all nodes across layers, one row per layer. Nodes
 * are placed left-to-right in first-seen order within their own layer's
 * row; a node id repeated in a later layer keeps its original position.
 * Edges are collected from every layer (tagged with the owning layer index
 * for visibility) and may reference a node id defined in a different layer
 * (e.g. a cache layer's edge into a base-row node).
 */
function layoutLayers(layers: LayerDef[]): Layout {
  const nodes = new Map<string, NodeInfo>()
  let aboveCount = 0
  let belowCount = 0

  layers.forEach((layer, layerIndex) => {
    const y = rowYFor(layerIndex, aboveCount, belowCount)
    if (layerIndex > 0) {
      if (layerIndex % 2 === 1) aboveCount += 1
      else belowCount += 1
    }
    let cursor = START_X
    for (const node of layer.nodes) {
      if (nodes.has(node.id)) continue
      const w = nodeWidth(node.label)
      nodes.set(node.id, { label: node.label, x: cursor, y, w, h: NODE_HEIGHT, layerIndex })
      cursor += w + NODE_GAP_X
    }
  })

  const edges: OwnedEdge[] = []
  layers.forEach((layer, layerIndex) => {
    for (const edge of layer.edges) {
      if (!nodes.has(edge.from) || !nodes.has(edge.to)) continue
      edges.push({ from: edge.from, to: edge.to, label: edge.label, layerIndex })
    }
  })

  let maxRight = START_X
  let minY = BASE_ROW_Y
  let maxY = BASE_ROW_Y + NODE_HEIGHT
  for (const n of nodes.values()) {
    maxRight = Math.max(maxRight, n.x + n.w)
    minY = Math.min(minY, n.y)
    maxY = Math.max(maxY, n.y + n.h)
  }

  return { nodes, edges, width: maxRight + START_X, minY: minY - 16, maxY: maxY + 16 }
}

function edgeLine(a: NodeInfo, b: NodeInfo): { x1: number; y1: number; x2: number; y2: number } {
  const aCenterX = a.x + a.w / 2
  const aCenterY = a.y + a.h / 2
  const bCenterX = b.x + b.w / 2
  const bCenterY = b.y + b.h / 2
  if (a.y === b.y) {
    return aCenterX < bCenterX
      ? { x1: a.x + a.w, y1: aCenterY, x2: b.x, y2: bCenterY }
      : { x1: a.x, y1: aCenterY, x2: b.x + b.w, y2: bCenterY }
  }
  return a.y < b.y
    ? { x1: aCenterX, y1: a.y + a.h, x2: bCenterX, y2: b.y }
    : { x1: aCenterX, y1: a.y, x2: bCenterX, y2: b.y + b.h }
}

interface LayerChipProps {
  label: string
  colorName: string
  on: boolean
  disabled: boolean
  onToggle: () => void
}

function LayerChip({ label, colorName, on, disabled, onToggle }: LayerChipProps) {
  const colorVar = `var(--ctp-${colorName})`
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      aria-pressed={on}
      className="rounded-[7px] border px-2.5 py-1 font-mono text-[12px] max-[879px]:min-h-11"
      style={{
        color: on ? colorVar : 'var(--ctp-faint)',
        borderColor: on ? colorVar : 'var(--ctp-line)',
        background: on ? 'var(--ctp-elev)' : 'transparent',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {`[${on ? 'x' : ' '}] ${label}`}
    </button>
  )
}

interface LayerControlsProps {
  layers: LayerDef[]
  visible: (i: number) => boolean
  onToggle: (i: number) => void
}

function LayerControls({ layers, visible, onToggle }: LayerControlsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {layers.map((layer, i) => (
        <LayerChip
          key={layer.id}
          label={layer.label}
          colorName={LAYER_COLOR_NAMES[i % LAYER_COLOR_NAMES.length] ?? 'mauve'}
          on={visible(i)}
          disabled={i === 0}
          onToggle={() => onToggle(i)}
        />
      ))}
    </div>
  )
}

/**
 * Layers-flow diagram block. Generalizes the prototype's fixed 3-row mock
 * (Reader.dc.html 625-641: Client/Limiter/API base row, Redis cache above,
 * Retry queue below) to n schema-driven layers. The first layer is always
 * the base row and is always visible (its control chip is disabled-on);
 * every other layer defaults off and toggles independently. Edges/nodes
 * referencing an id absent from the union of all layers' nodes are dropped
 * defensively rather than crashing on an undefined position.
 */
export function Layers({ block, ...anchor }: { block: LayersBlock } & BlockAnchor) {
  const markerId = useId()
  const layout = useMemo(() => layoutLayers(block.layers), [block.layers])
  const [visibleLayers, setVisibleLayers] = useState<Record<number, boolean>>({})

  function isVisible(i: number): boolean {
    return i === 0 || !!visibleLayers[i]
  }

  function toggle(i: number) {
    if (i === 0) return
    setVisibleLayers((v) => ({ ...v, [i]: !v[i] }))
  }

  const height = layout.maxY - layout.minY

  return (
    <DiagramCard
      {...titleCaption(anchor, block.title, 'Layers')}
      controls={<LayerControls layers={block.layers} visible={isVisible} onToggle={toggle} />}
    >
      <svg
        width={layout.width}
        height={height}
        viewBox={`0 ${layout.minY} ${layout.width} ${height}`}
        style={{ display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' }}
      >
        {layout.edges.map((edge, i) => {
          const a = layout.nodes.get(edge.from)
          const b = layout.nodes.get(edge.to)
          if (!a || !b) return null
          const on = isVisible(edge.layerIndex)
          const { x1, y1, x2, y2 } = edgeLine(a, b)
          return (
            <g key={i} style={{ opacity: on ? 0.8 : 0.12, transition: 'opacity .3s' }}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                strokeWidth={1.5}
                style={{ stroke: 'var(--ctp-subtext0)' }}
                markerEnd={`url(#${markerId})`}
              />
              {edge.label ? (
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 4}
                  textAnchor="middle"
                  fontSize={9}
                  style={svgTextStyle({ fill: 'var(--ctp-subtext0)' })}
                >
                  {edge.label}
                </text>
              ) : null}
            </g>
          )
        })}
        {Array.from(layout.nodes.entries()).map(([id, n]) => {
          const on = isVisible(n.layerIndex)
          const colorVar = `var(--ctp-${LAYER_COLOR_NAMES[n.layerIndex % LAYER_COLOR_NAMES.length] ?? 'mauve'})`
          return (
            <g key={id} style={{ opacity: on ? 1 : 0.14, transition: 'opacity .3s' }}>
              <rect
                x={n.x}
                y={n.y}
                width={n.w}
                height={n.h}
                rx={7}
                strokeWidth={1.6}
                style={{ fill: 'var(--ctp-card)', stroke: colorVar }}
              />
              <text
                x={n.x + n.w / 2}
                y={n.y + 21}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                style={svgTextStyle({ fill: colorVar })}
              >
                {n.label}
              </text>
            </g>
          )
        })}
        <defs>
          <marker id={markerId} markerWidth={8} markerHeight={8} refX={6} refY={3} orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" style={{ fill: 'var(--ctp-subtext0)' }} />
          </marker>
        </defs>
      </svg>
    </DiagramCard>
  )
}
