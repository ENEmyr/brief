'use client'
import { useId, useMemo } from 'react'
import type { Block } from '@brief/schema'
import { DiagramCard } from '../DiagramCard'

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

interface Layout {
  boxes: TableBox[]
  byName: Map<string, TableBox>
  width: number
  height: number
}

/**
 * Horizontal flow for up to 2 tables, wrapping into a 2-column grid beyond
 * that (per brief). Grid columns/rows use uniform widths/heights (the
 * widest table in the payload / tallest table per row) so boxes line up
 * cleanly even though each table's own content size differs.
 */
function layoutTables(tables: TableDef[]): Layout {
  const cols = tables.length > 2 ? 2 : Math.max(1, tables.length)
  const widths = tables.map(tableWidth)
  const heights = tables.map(tableHeight)
  const colWidth = Math.max(0, ...widths) + GAP_X
  const rows = Math.ceil(tables.length / cols)
  const rowHeights: number[] = Array.from({ length: rows }, (_, r) => {
    const inRow = heights.filter((_, i) => Math.floor(i / cols) === r)
    return Math.max(0, ...inRow)
  })
  const rowOffsets: number[] = []
  let cursorY = START_Y
  for (let r = 0; r < rows; r++) {
    rowOffsets[r] = cursorY
    cursorY += (rowHeights[r] ?? 0) + GAP_Y
  }

  const boxes: TableBox[] = tables.map((table, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return { table, x: START_X + col * colWidth, y: rowOffsets[row] ?? START_Y, w: widths[i] ?? MIN_TABLE_W, h: heights[i] ?? HEADER_H }
  })

  const byName = new Map(boxes.map((b) => [b.table.name, b]))
  const width = cols * colWidth + START_X
  const height = (rowOffsets[rows - 1] ?? START_Y) + (rowHeights[rows - 1] ?? 0) + START_Y

  return { boxes, byName, width, height }
}

interface FkEdge {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Line from the fk column row's right edge to the target table header's left edge. */
function fkEdges(boxes: TableBox[], byName: Map<string, TableBox>): FkEdge[] {
  const edges: FkEdge[] = []
  for (const box of boxes) {
    box.table.columns.forEach((col, i) => {
      if (!col.fk) return
      const target = byName.get(col.fk.table)
      if (!target) return
      const rowY = box.y + HEADER_H + i * ROW_H + ROW_H / 2
      edges.push({
        x1: box.x + box.w,
        y1: rowY,
        x2: target.x,
        y2: target.y + HEADER_H / 2,
      })
    })
  }
  return edges
}

/**
 * Entity-relationship diagram block. No prototype reference exists for erd;
 * styled to match the other custom SVG blocks (Seq/StateMachine/Layers):
 * mono labels, --ctp-* CSS var colors, unique marker id via useId. PK
 * columns get a bold underlined "PK " text prefix, FK columns a teal " FK"
 * text suffix (no decorative glyphs, per project convention). An fk
 * referencing an unknown table is dropped defensively — its column marker
 * still renders, only the connecting edge is skipped.
 */
export function Erd({ block }: { block: ErdBlock }) {
  const markerId = useId()
  const layout = useMemo(() => layoutTables(block.tables), [block.tables])
  const edges = useMemo(() => fkEdges(layout.boxes, layout.byName), [layout])

  return (
    <DiagramCard caption={block.title ?? 'Entity relationship'}>
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} style={{ width: '100%', height: 'auto' }}>
        {edges.map((edge, i) => (
          <line
            key={i}
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            strokeWidth={1.3}
            strokeDasharray="4 3"
            style={{ stroke: 'var(--ctp-teal)' }}
            markerEnd={`url(#${markerId})`}
          />
        ))}
        {layout.boxes.map((box) => (
          <g key={box.table.name}>
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
                  <text x={box.x + 8} y={rowY + ROW_H / 2 + 3.5} fontFamily="'IBM Plex Mono', monospace" fontSize={10}>
                    {col.pk ? (
                      <tspan fontWeight={700} textDecoration="underline" style={{ fill: 'var(--ctp-text)' }}>
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
