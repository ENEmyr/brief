'use client'
import { useId, useMemo, useState } from 'react'
import type { Block } from '@brief/schema'
import { DiagramCard } from '../DiagramCard'

type StateBlock = Extract<Block, { type: 'state' }>
type Transition = StateBlock['transitions'][number]

// Cycled by BFS discovery order (not array order), so a node's color stays
// stable as long as its reachability from `initial` is stable.
const NODE_COLOR_NAMES = ['blue', 'mauve', 'green', 'peach', 'red'] as const

const NODE_WIDTH = 74
const NODE_HEIGHT = 32
const COL_STEP = 120
const ROW_STEP = 56

interface NodePosition {
  col: number
  row: number
}

interface Layout {
  position: Map<string, NodePosition>
  colorOf: Map<string, string>
  maxCol: number
  maxRow: number
}

/**
 * BFS from `initial` over `transitions` assigns each reachable state a
 * (column, row) = (depth, discovery order within that depth). States not
 * reachable from `initial` are appended into the last column used by the
 * BFS (or column 0 if `initial` itself isn't a known state id), so nothing
 * is left off the diagram. Colors cycle by overall discovery order.
 */
function layoutStates(states: StateBlock['states'], transitions: Transition[], initial: string): Layout {
  const stateIds = new Set(states.map((s) => s.id))
  const adjacency = new Map<string, string[]>()
  for (const t of transitions) {
    if (!stateIds.has(t.from) || !stateIds.has(t.to)) continue
    const list = adjacency.get(t.from) ?? []
    list.push(t.to)
    adjacency.set(t.from, list)
  }

  const position = new Map<string, NodePosition>()
  const discoveryOrder: string[] = []
  const colCounts: number[] = []

  if (stateIds.has(initial)) {
    const visited = new Set<string>([initial])
    const queue: Array<{ id: string; depth: number }> = [{ id: initial, depth: 0 }]
    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) break
      const { id, depth } = current
      const row = colCounts[depth] ?? 0
      colCounts[depth] = row + 1
      position.set(id, { col: depth, row })
      discoveryOrder.push(id)
      for (const next of adjacency.get(id) ?? []) {
        if (!visited.has(next)) {
          visited.add(next)
          queue.push({ id: next, depth: depth + 1 })
        }
      }
    }
  }

  const lastCol = colCounts.length > 0 ? colCounts.length - 1 : 0
  for (const s of states) {
    if (position.has(s.id)) continue
    const row = colCounts[lastCol] ?? 0
    colCounts[lastCol] = row + 1
    position.set(s.id, { col: lastCol, row })
    discoveryOrder.push(s.id)
  }

  const colorOf = new Map<string, string>()
  discoveryOrder.forEach((id, i) => colorOf.set(id, NODE_COLOR_NAMES[i % NODE_COLOR_NAMES.length] ?? 'mauve'))

  let maxCol = 0
  let maxRow = 0
  for (const pos of position.values()) {
    maxCol = Math.max(maxCol, pos.col)
    maxRow = Math.max(maxRow, pos.row)
  }

  return { position, colorOf, maxCol, maxRow }
}

interface StateControlsProps {
  current: string
  events: Transition[]
  onTransition: (to: string) => void
  onReset: () => void
}

function StateControls({ current, events, onTransition, onReset }: StateControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[11.5px] text-sub">
        State: <b className="text-mauve">{current}</b>
      </span>
      {events.length > 0 ? (
        events.map((t, i) => (
          <button
            key={`${t.from}-${t.to}-${i}`}
            type="button"
            onClick={() => onTransition(t.to)}
            className="rounded-[7px] border border-mauve bg-mauvesoft px-[11px] py-1 text-[12px] text-mauve max-[879px]:min-h-11"
          >
            {t.label ?? `to ${t.to}`}
          </button>
        ))
      ) : (
        <button
          type="button"
          onClick={onReset}
          className="rounded-[7px] border border-line bg-elev px-[11px] py-1 text-[12px] text-sub max-[879px]:min-h-11"
        >
          ↺ reset
        </button>
      )}
    </div>
  )
}

/**
 * State machine diagram block. Generalizes the prototype's fixed 5-node mock
 * (Reader.dc.html lines 644-663) to schema-driven states/transitions, laid
 * out by BFS depth from `initial` instead of hand-placed coordinates.
 * Transitions referencing an unknown state id are dropped defensively.
 */
export function StateMachine({ block }: { block: StateBlock }) {
  const markerId = useId()
  const [current, setCurrent] = useState(block.initial)

  const stateIds = useMemo(() => new Set(block.states.map((s) => s.id)), [block.states])
  const transitions = useMemo(
    () => block.transitions.filter((t) => stateIds.has(t.from) && stateIds.has(t.to)),
    [block.transitions, stateIds],
  )
  const layout = useMemo(
    () => layoutStates(block.states, transitions, block.initial),
    [block.states, transitions, block.initial],
  )

  const width = 24 + (layout.maxCol + 1) * COL_STEP + 60
  const height = 20 + (layout.maxRow + 1) * ROW_STEP + 30

  function coordsOf(id: string): { x: number; y: number } {
    const pos = layout.position.get(id)
    return { x: 24 + (pos?.col ?? 0) * COL_STEP, y: 20 + (pos?.row ?? 0) * ROW_STEP }
  }

  const events = transitions.filter((t) => t.from === current)

  return (
    <DiagramCard
      caption={block.title ?? 'State machine'}
      controls={
        <StateControls
          current={current}
          events={events}
          onTransition={setCurrent}
          onReset={() => setCurrent(block.initial)}
        />
      }
    >
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
        {transitions.map((t, i) => {
          const a = coordsOf(t.from)
          const b = coordsOf(t.to)
          return (
            <line
              key={i}
              x1={a.x + 34}
              y1={a.y + 16}
              x2={b.x + 2}
              y2={b.y + 16}
              strokeWidth={1.4}
              style={{ stroke: 'var(--ctp-line)' }}
              markerEnd={`url(#${markerId})`}
            />
          )
        })}
        {block.states.map((s) => {
          const { x, y } = coordsOf(s.id)
          const isCurrent = s.id === current
          const colorName = layout.colorOf.get(s.id) ?? 'mauve'
          const colorVar = `var(--ctp-${colorName})`
          return (
            <g key={s.id}>
              <rect
                x={x}
                y={y}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={9}
                strokeWidth={isCurrent ? 2 : 1.4}
                style={{
                  fill: isCurrent ? colorVar : 'var(--ctp-card)',
                  stroke: colorVar,
                  transition: 'all .25s',
                }}
              />
              <text
                x={x + NODE_WIDTH / 2}
                y={y + 20}
                textAnchor="middle"
                fontFamily="'IBM Plex Mono', monospace"
                fontSize={11}
                fontWeight={isCurrent ? 700 : 500}
                style={{ fill: isCurrent ? 'var(--ctp-oncolor)' : colorVar }}
              >
                {s.label}
              </text>
            </g>
          )
        })}
        <defs>
          <marker id={markerId} markerWidth={8} markerHeight={8} refX={6} refY={3} orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" style={{ fill: 'var(--ctp-faint)' }} />
          </marker>
        </defs>
      </svg>
    </DiagramCard>
  )
}
