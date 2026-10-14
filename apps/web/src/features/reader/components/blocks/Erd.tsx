'use client'
import { useMemo, useState } from 'react'
import type { Block } from '@brief/schema'
import { BlockCard, cardHeader } from '../BlockCard'
import type { BlockAnchor } from '../blockAnchor'
import { useDiagramFullScreen } from '../fullScreen'
import { estimateTextWidth } from '../../lib/svgText'
import { DiagramFooter, Edge, EDGE_TONE, EdgeLayer, type Point } from './diagramParts'

type ErdBlock = Extract<Block, { type: 'erd' }>
type TableDef = ErdBlock['tables'][number]

/** B-Blocks2:86-88: 260 wide, a 36px header, 28px rows and 12 below them; tables 100 apart from x 60, y 40. */
const TABLE_MIN_WIDTH = 260
const HEADER_H = 36
const ROW_H = 28
const TABLE_PAD_BOTTOM = 12
const GAP_X = 100
const GAP_Y = 60
const LEFT = 60
const TOP = 40
const RIGHT = 60
const BOTTOM = 50
const PER_ROW = 3
const ROW_PAD_X = 12
const KEY_COL = 20
const CELL_GAP = 8
/** Edge labels sit 12px under their edge (B-Blocks2:89: edge y 58, label top 70). */
const LABEL_GAP = 12
const TIP_GAP = 1
/** Over-the-top routes clear the table tops by this much. */
const OVER = 20

function tableWidth(table: TableDef): number {
  const name = estimateTextWidth(table.name, 13) + 2 * ROW_PAD_X
  const columns = table.columns.map(
    (c) =>
      2 * ROW_PAD_X +
      KEY_COL +
      estimateTextWidth(c.name, 12) +
      estimateTextWidth(c.type, 12) +
      2 * CELL_GAP,
  )
  return Math.ceil(Math.max(TABLE_MIN_WIDTH, name, ...columns))
}

function tableHeight(table: TableDef): number {
  return HEADER_H + table.columns.length * ROW_H + TABLE_PAD_BOTTOM
}

interface TableBox {
  table: TableDef
  x: number
  y: number
  w: number
  h: number
  row: number
  col: number
}

interface FkEdge {
  /** `table.column` of the foreign key, the hover handle. */
  key: string
  source: string
  target: string
  targetColumn: string
  points: Point[]
  label: { text: string; left: number; top: number; width: number }
}

interface ErdLayout {
  width: number
  height: number
  boxes: TableBox[]
  edges: FkEdge[]
}

function computeErdLayout(tables: readonly TableDef[]): ErdLayout {
  const widths = tables.map(tableWidth)
  const rows = Math.ceil(tables.length / PER_ROW)
  const colWidth = (col: number) =>
    Math.max(0, ...widths.filter((_, i) => i % PER_ROW === col))
  const colX: number[] = []
  let cursor = LEFT
  for (let c = 0; c < Math.min(PER_ROW, tables.length); c++) {
    colX.push(cursor)
    cursor += colWidth(c) + GAP_X
  }
  const rowY: number[] = []
  let top = TOP
  for (let r = 0; r < rows; r++) {
    rowY.push(top)
    const tallest = Math.max(
      0,
      ...tables.filter((_, i) => Math.floor(i / PER_ROW) === r).map(tableHeight),
    )
    top += tallest + GAP_Y
  }

  const boxes: TableBox[] = tables.map((table, i) => {
    const col = i % PER_ROW
    const row = Math.floor(i / PER_ROW)
    return {
      table,
      x: colX[col] ?? LEFT,
      y: rowY[row] ?? TOP,
      w: widths[i] ?? TABLE_MIN_WIDTH,
      h: tableHeight(table),
      row,
      col,
    }
  })
  const byName = new Map(boxes.map((b) => [b.table.name, b]))
  const headerMid = (b: TableBox) => b.y + HEADER_H / 2
  const usedGaps = new Map<string, number>()

  const edges: FkEdge[] = boxes.flatMap((source) =>
    source.table.columns.flatMap((column, columnIndex): FkEdge[] => {
      if (!column.fk) return []
      const target = byName.get(column.fk.table)
      if (!target) return []
      const text = column.name
      const width = Math.ceil(estimateTextWidth(text, 11))
      const key = `${source.table.name}.${column.name}`
      const base = { key, source: source.table.name, target: target.table.name, targetColumn: column.fk.column }

      // A self-reference loops out of the right side and back into the header.
      if (source === target) {
        const x = source.x + source.w
        const y = source.y + HEADER_H + columnIndex * ROW_H + ROW_H / 2
        return [
          {
            ...base,
            points: [
              { x, y },
              { x: x + OVER, y },
              { x: x + OVER, y: headerMid(source) },
              { x: x + TIP_GAP, y: headerMid(source) },
            ],
            label: { text, left: x + OVER + 4, top: headerMid(source) + LABEL_GAP, width },
          },
        ]
      }

      // Neighbours in a row: straight across at the header line (B-Blocks2:84-85).
      if (source.row === target.row && Math.abs(source.col - target.col) === 1) {
        const right = target.col > source.col
        const gap = `${source.row}:${Math.min(source.col, target.col)}`
        const nth = usedGaps.get(gap) ?? 0
        usedGaps.set(gap, nth + 1)
        const y = headerMid(target) + nth * ROW_H
        const x1 = right ? source.x + source.w : source.x
        const x2 = right ? target.x - TIP_GAP : target.x + target.w + TIP_GAP
        return [
          {
            ...base,
            points: [
              { x: x1, y },
              { x: x2, y },
            ],
            label: { text, left: (x1 + x2) / 2 - width / 2, top: y + LABEL_GAP, width },
          },
        ]
      }

      // Farther along a row: over the tops of the tables in between.
      if (source.row === target.row) {
        const y = source.y - OVER
        const sx = source.x + source.w / 2
        const tx = target.x + target.w / 2
        return [
          {
            ...base,
            points: [
              { x: sx, y: source.y },
              { x: sx, y },
              { x: tx, y },
              { x: tx, y: target.y - TIP_GAP },
            ],
            label: { text, left: (sx + tx) / 2 - width / 2, top: y - LABEL_GAP - 16, width },
          },
        ]
      }

      // Another row: out of the side, down the gap beside the source's column
      // (as wide as its widest table), in from the side.
      const right = target.x >= source.x
      const x1 = right ? source.x + source.w : source.x
      const columnLeft = colX[source.col] ?? LEFT
      const channel = right ? columnLeft + colWidth(source.col) + GAP_X / 2 : columnLeft - GAP_X / 2
      const x2 = right ? target.x - TIP_GAP : target.x + target.w + TIP_GAP
      const enterX = target.col === source.col ? (right ? target.x + target.w + TIP_GAP : target.x - TIP_GAP) : x2
      return [
        {
          ...base,
          points: [
            { x: x1, y: headerMid(source) },
            { x: channel, y: headerMid(source) },
            { x: channel, y: headerMid(target) },
            { x: enterX, y: headerMid(target) },
          ],
          label: { text, left: channel - width / 2, top: (headerMid(source) + headerMid(target)) / 2 - 8, width },
        },
      ]
    }),
  )

  const right = Math.max(...boxes.map((b) => b.x + b.w), ...edges.flatMap((e) => e.points.map((p) => p.x)))
  const bottom = Math.max(...boxes.map((b) => b.y + b.h))
  return { width: Math.ceil(right + RIGHT), height: Math.ceil(bottom + BOTTOM), boxes, edges }
}

/**
 * Entity-relationship diagram block (B-Blocks2:80-94). PK is lime, FK cyan.
 * Hovering an FK row highlights the row it points at and the connector. An fk
 * to an unknown table keeps its FK marker; only the edge is skipped.
 */
export function Erd({ block, ...anchor }: { block: ErdBlock } & BlockAnchor) {
  const layout = useMemo(() => computeErdLayout(block.tables), [block.tables])
  const [hovered, setHovered] = useState<string | null>(null)
  const active = layout.edges.find((e) => e.key === hovered)

  const diagram = (
    <div className="relative mx-auto text-[13px] leading-4" style={{ width: layout.width, height: layout.height }}>
      <EdgeLayer width={layout.width} height={layout.height}>
        {layout.edges.map((e, i) => (
          <Edge
            key={i}
            points={e.points}
            dataState={e === active ? 'active' : undefined}
            className={e === active ? EDGE_TONE.accent : EDGE_TONE.sub}
          />
        ))}
      </EdgeLayer>
      {layout.boxes.map((box, i) => (
        <div
          key={i}
          data-table={box.table.name}
          className="absolute box-border flex flex-col overflow-hidden rounded-[6px] border border-line2 bg-elev text-text"
          style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
        >
          <span className="flex h-9 shrink-0 items-center bg-chip px-3 font-mono font-medium">{box.table.name}</span>
          {box.table.columns.map((column, i) => {
            const key = `${box.table.name}.${column.name}`
            const target = active?.target === box.table.name && active.targetColumn === column.name
            return (
              <span
                key={i}
                data-column={column.name}
                onPointerEnter={column.fk ? () => setHovered(key) : undefined}
                onPointerLeave={column.fk ? () => setHovered(null) : undefined}
                className={`flex h-7 shrink-0 items-center gap-2 px-3 font-mono text-[12px] ${
                  hovered === key || target ? 'bg-[var(--c-row-hover)]' : ''
                }`}
              >
                <span className={`w-5 shrink-0 ${column.pk ? 'text-accent-text' : 'text-info'}`}>
                  {column.pk ? 'PK' : column.fk ? 'FK' : ''}
                </span>
                <span className="grow whitespace-nowrap">{column.name}</span>
                <span className="whitespace-nowrap text-faint">{column.type}</span>
              </span>
            )
          })}
        </div>
      ))}
      {layout.edges.map((e, i) => (
        <div
          key={i}
          className="absolute whitespace-nowrap text-center font-mono text-[11px] text-info"
          style={{ left: e.label.left, top: e.label.top, width: e.label.width }}
        >
          {e.label.text}
        </div>
      ))}
    </div>
  )
  const onFullScreen = useDiagramFullScreen(diagram, { heading: { kind: block.type, title: block.title } })
  const tables = block.tables.length
  const relations = layout.edges.length

  return (
    <BlockCard
      {...cardHeader(block, anchor)}
      captionSuffix={`${tables} ${tables === 1 ? 'table' : 'tables'} / ${relations} ${
        relations === 1 ? 'relation' : 'relations'
      }`}
      fullScreen={onFullScreen}
    >
      <div className="overflow-x-auto py-3">{diagram}</div>
      <DiagramFooter>
        <span>PK lime, FK cyan. Hovering an FK row highlights its target row and the connector.</span>
      </DiagramFooter>
    </BlockCard>
  )
}
