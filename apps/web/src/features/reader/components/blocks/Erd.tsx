'use client'
import { useCallback, useId, useMemo, useRef, useState } from 'react'
import type { Block } from '@brief/schema'
import { useBlockLayout } from '@/features/diagram-layout'
import type { NodeOffset } from '@/features/diagram-layout'
import { DiagramCard } from '../DiagramCard'
import { titleCaption } from '../blockAnchor'
import type { BlockAnchor } from '../blockAnchor'

type ErdBlock = Extract<Block, { type: 'erd' }>
type TableDef = ErdBlock['tables'][number]
type ColumnDef = TableDef['columns'][number]

const HEADER_H = 22
const ROW_H = 16
const START_X = 20
const START_Y = 20
const GAP_X = 40
const GAP_Y = 30
const MIN_TABLE_W = 150
/** How far an edge stands off a box before it turns. */
const EDGE_PAD = 16
const CANVAS_PAD = 12

function columnLineText(col: ColumnDef): string {
  return `${col.pk ? 'PK ' : ''}${col.name} ${col.type}${col.fk ? ' FK' : ''}`
}

function tableWidth(table: TableDef): number {
  const longest = Math.max(table.name.length, ...table.columns.map((c) => columnLineText(c).length))
  return Math.max(MIN_TABLE_W, longest * 6.6 + 24)
}

function tableHeight(table: TableDef): number {
  return HEADER_H + table.columns.length * ROW_H
}

interface TableBox {
  table: TableDef
  x: number
  y: number
  w: number
  h: number
}

/**
 * Horizontal flow for up to 2 tables, wrapping into a 2-column grid beyond
 * that. Each column is only as wide as the widest table IN THAT COLUMN: sizing
 * every column to the widest table in the whole diagram padded the narrow ones
 * with dead space and pushed the boxes needlessly far apart.
 */
function layoutTables(tables: TableDef[]): TableBox[] {
  const cols = tables.length > 2 ? 2 : Math.max(1, tables.length)
  const widths = tables.map(tableWidth)
  const heights = tables.map(tableHeight)
  const rows = Math.ceil(tables.length / cols)

  const colWidths = Array.from({ length: cols }, (_, c) =>
    Math.max(0, ...widths.filter((_, i) => i % cols === c)),
  )
  const colOffsets: number[] = []
  let cursorX = START_X
  for (let c = 0; c < cols; c++) {
    colOffsets[c] = cursorX
    cursorX += (colWidths[c] ?? 0) + GAP_X
  }

  const rowOffsets: number[] = []
  let cursorY = START_Y
  for (let r = 0; r < rows; r++) {
    rowOffsets[r] = cursorY
    const tallest = Math.max(0, ...heights.filter((_, i) => Math.floor(i / cols) === r))
    cursorY += tallest + GAP_Y
  }

  return tables.map((table, i) => ({
    table,
    x: colOffsets[i % cols] ?? START_X,
    y: rowOffsets[Math.floor(i / cols)] ?? START_Y,
    w: widths[i] ?? MIN_TABLE_W,
    h: heights[i] ?? HEADER_H,
  }))
}

/**
 * Routes each FK edge orthogonally, choosing which side of each box to leave
 * from and arrive at based on where the two boxes actually sit. The old version
 * always left the source's right edge and arrived at the target's left edge, so
 * an edge to a table above or to the left doubled straight back across the
 * boxes it had just left, which is most of why the diagram was hard to read.
 */
function fkEdgePath(source: TableBox, columnIndex: number, target: TableBox): string {
  const y1 = source.y + HEADER_H + columnIndex * ROW_H + ROW_H / 2

  // A self-referencing FK (a parent_id pointing at its own table) has no
  // "other side" to aim at: loop out and back on the right.
  if (source === target) {
    const x = source.x + source.w
    return `M${x},${y1} H${x + EDGE_PAD} V${source.y + HEADER_H / 2} H${x}`
  }

  const goRight = target.x + target.w / 2 >= source.x + source.w / 2
  const x1 = goRight ? source.x + source.w : source.x
  const x2 = goRight ? target.x : target.x + target.w
  const y2 = target.y + HEADER_H / 2

  // Stand off the source before turning, so the elbow never sits on the border
  // even when the two boxes overlap horizontally (same grid column).
  const midX = goRight
    ? Math.max(x1 + EDGE_PAD, (x1 + x2) / 2)
    : Math.min(x1 - EDGE_PAD, (x1 + x2) / 2)

  return `M${x1},${y1} H${midX} V${y2} H${x2}`
}

/**
 * Entity-relationship diagram block. Styled to match the other custom SVG
 * blocks (Seq/StateMachine/Layers): mono labels, --ctp-* CSS var colors, unique
 * marker id via useId. PK columns get a bold underlined "PK " prefix, FK columns
 * a teal " FK" suffix. An fk referencing an unknown table is dropped
 * defensively: its column marker still renders, only the edge is skipped.
 *
 * Tables can be dragged. The auto-layout is a starting point, not a verdict, and
 * no automatic placement survives contact with a real schema. What is stored is
 * the OFFSET from the auto-laid-out position (see diagram-layout), in this
 * reader's browser only.
 */
export function Erd({ block, ...anchor }: { block: ErdBlock } & BlockAnchor) {
  const markerId = useId()
  const svgRef = useRef<SVGSVGElement>(null)

  const base = useMemo(() => layoutTables(block.tables), [block.tables])
  const names = useMemo(() => block.tables.map((t) => t.name), [block.tables])
  const blockKey = `${anchor.sid ?? 'x'}:${anchor.bid ?? 'x'}`
  const { offsets, moved, moveNode, reset } = useBlockLayout(blockKey, names)

  // The offset being dragged right now, not yet committed to storage. The
  // in-flight gesture is tracked in refs, not state: pointer handlers must read
  // the CURRENT drag, and a state read would see the previous render's value if
  // two pointer events land in the same batch.
  const [drag, setDrag] = useState<{ name: string; offset: NodeOffset } | null>(null)
  const dragStartRef = useRef<{ name: string; x: number; y: number; base: NodeOffset } | null>(null)
  const dragOffsetRef = useRef<NodeOffset | null>(null)

  const offsetFor = useCallback(
    (name: string): NodeOffset => {
      if (drag?.name === name) return drag.offset
      return offsets[name] ?? { dx: 0, dy: 0 }
    },
    [drag, offsets],
  )

  const boxes = useMemo(
    () =>
      base.map((box) => {
        const { dx, dy } = offsetFor(box.table.name)
        return { ...box, x: box.x + dx, y: box.y + dy }
      }),
    [base, offsetFor],
  )

  const byName = useMemo(() => new Map(boxes.map((b) => [b.table.name, b])), [boxes])

  const edges = useMemo(() => {
    const paths: string[] = []
    for (const box of boxes) {
      box.table.columns.forEach((col, i) => {
        if (!col.fk) return
        const target = byName.get(col.fk.table)
        if (!target) return
        paths.push(fkEdgePath(box, i, target))
      })
    }
    return paths
  }, [boxes, byName])

  // Dragged boxes can leave the auto-layout's bounds, so the viewBox tracks the
  // content rather than a fixed size, and the diagram never clips itself.
  const viewBox = useMemo(() => {
    const minX = Math.min(0, ...boxes.map((b) => b.x - CANVAS_PAD))
    const minY = Math.min(0, ...boxes.map((b) => b.y - CANVAS_PAD))
    const maxX = Math.max(...boxes.map((b) => b.x + b.w + CANVAS_PAD + EDGE_PAD), START_X)
    const maxY = Math.max(...boxes.map((b) => b.y + b.h + CANVAS_PAD), START_Y)
    return { minX, minY, width: maxX - minX, height: maxY - minY }
  }, [boxes])

  /** Client pixels per diagram unit. The SVG scales to its box and the card can
   *  additionally be zoomed, so measure rather than assume. */
  const unitsPerPixel = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect?.width) return 1
    return viewBox.width / rect.width
  }, [viewBox.width])

  function handlePointerDown(event: React.PointerEvent, name: string) {
    // Beat the card's pan: a drag that starts on a table moves the table.
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const base = offsets[name] ?? { dx: 0, dy: 0 }
    dragStartRef.current = { name, x: event.clientX, y: event.clientY, base }
    dragOffsetRef.current = base
    setDrag({ name, offset: base })
  }

  function handlePointerMove(event: React.PointerEvent) {
    const start = dragStartRef.current
    if (!start) return
    event.stopPropagation()
    const scale = unitsPerPixel()
    const offset = {
      dx: start.base.dx + (event.clientX - start.x) * scale,
      dy: start.base.dy + (event.clientY - start.y) * scale,
    }
    dragOffsetRef.current = offset
    setDrag({ name: start.name, offset })
  }

  function handlePointerUp(event: React.PointerEvent) {
    const start = dragStartRef.current
    if (!start) return
    event.stopPropagation()
    moveNode(start.name, dragOffsetRef.current ?? start.base)
    dragStartRef.current = null
    dragOffsetRef.current = null
    setDrag(null)
  }

  return (
    <DiagramCard
      {...titleCaption(anchor, block.title, 'Entity relationship')}
      controls={
        moved ? (
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-line bg-card px-[9px] py-[3px] font-mono text-[10.5px] text-mauve transition-colors hover:border-mauve hover:bg-mauvesoft"
          >
            Reset layout
          </button>
        ) : undefined
      }
    >
      <svg
        ref={svgRef}
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
        style={{ width: '100%', height: 'auto' }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {edges.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            strokeWidth={1.3}
            strokeDasharray="4 3"
            style={{ stroke: 'var(--ctp-teal)' }}
            markerEnd={`url(#${markerId})`}
          />
        ))}
        {boxes.map((box) => (
          <g
            key={box.table.name}
            data-table={box.table.name}
            onPointerDown={(event) => handlePointerDown(event, box.table.name)}
            style={{ cursor: drag?.name === box.table.name ? 'grabbing' : 'grab' }}
          >
            <rect
              x={box.x}
              y={box.y}
              width={box.w}
              height={HEADER_H}
              style={{ fill: 'var(--ctp-mauvesoft)', stroke: 'var(--ctp-line)' }}
            />
            <text
              x={box.x + 8}
              y={box.y + 15}
              fontFamily="'IBM Plex Mono', monospace"
              fontSize={11.5}
              fontWeight={700}
              style={{ fill: 'var(--ctp-mauve)' }}
            >
              {box.table.name}
            </text>
            {box.table.columns.map((col, i) => {
              const rowY = box.y + HEADER_H + i * ROW_H
              return (
                <g key={col.name}>
                  <rect
                    x={box.x}
                    y={rowY}
                    width={box.w}
                    height={ROW_H}
                    style={{ fill: 'var(--ctp-card)', stroke: 'var(--ctp-line2)' }}
                  />
                  <text
                    x={box.x + 8}
                    y={rowY + ROW_H / 2 + 3.5}
                    fontFamily="'IBM Plex Mono', monospace"
                    fontSize={10}
                  >
                    {col.pk ? (
                      <tspan
                        fontWeight={700}
                        textDecoration="underline"
                        style={{ fill: 'var(--ctp-text)' }}
                      >
                        {'PK '}
                      </tspan>
                    ) : null}
                    <tspan style={{ fill: 'var(--ctp-subtext0)' }}>{`${col.name} ${col.type}`}</tspan>
                    {col.fk ? <tspan style={{ fill: 'var(--ctp-teal)' }}>{' FK'}</tspan> : null}
                  </text>
                </g>
              )
            })}
          </g>
        ))}
        <defs>
          <marker id={markerId} markerWidth={8} markerHeight={8} refX={6} refY={3} orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" style={{ fill: 'var(--ctp-teal)' }} />
          </marker>
        </defs>
      </svg>
    </DiagramCard>
  )
}
