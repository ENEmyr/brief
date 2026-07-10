'use client'
import { useId, useState } from 'react'
import type { Block } from '@brief/schema'
import { DiagramCard } from '../DiagramCard'

type SeqBlock = Extract<Block, { type: 'seq' }>

// Cycled per visible step (not per actor). When the cycled name lands on
// 'red' the arrow gets a dashed stroke and the label is colored red too,
// matching the prototype's explicit per-step color tagging.
const STEP_COLOR_NAMES = ['blue', 'mauve', 'green', 'red', 'teal'] as const

function actorX(i: number, actorCount: number): number {
  return 70 + i * (340 / Math.max(1, actorCount - 1))
}

interface SeqControlsProps {
  step: number
  max: number
  onPrev: () => void
  onNext: () => void
}

function controlButtonClass(disabled: boolean): string {
  const base = 'rounded-[7px] border px-3 py-[5px] text-[12.5px] font-sans max-[879px]:min-h-11'
  return disabled ? `${base} border-line bg-elev text-faint cursor-default` : `${base} border-line bg-card text-text cursor-pointer`
}

function SeqControls({ step, max, onPrev, onNext }: SeqControlsProps) {
  const prevDisabled = step <= 0
  const nextDisabled = step >= max
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onPrev} disabled={prevDisabled} className={controlButtonClass(prevDisabled)}>
        ‹ Prev
      </button>
      <button type="button" onClick={onNext} disabled={nextDisabled} className={controlButtonClass(nextDisabled)}>
        Next ›
      </button>
      <span className="ml-auto font-mono text-[11.5px] text-sub">
        step {step}/{max}
      </span>
    </div>
  )
}

/**
 * Sequence diagram block. Generalizes the prototype's fixed 3-actor mock
 * (Reader.dc.html lines 596-622) to n actors laid out evenly across a fixed
 * 480-wide viewBox, and n schema-driven steps instead of a hardcoded array.
 * Steps referencing an actor name not present in `actors` are dropped
 * defensively rather than crashing on an undefined x position.
 */
export function Seq({ block }: { block: SeqBlock }) {
  const markerId = useId()
  const actors = block.actors
  const actorIndex = new Map(actors.map((a, i) => [a, i]))
  const steps = block.steps.filter((s) => actorIndex.has(s.from) && actorIndex.has(s.to))
  const [step, setStep] = useState(steps.length)

  const height = 34 + (steps.length + 1) * 30 + 12
  const lifelineBottom = height - 12

  return (
    <DiagramCard
      caption={block.title ?? 'Sequence'}
      controls={
        <SeqControls
          step={step}
          max={steps.length}
          onPrev={() => setStep((s) => Math.max(0, s - 1))}
          onNext={() => setStep((s) => Math.min(steps.length, s + 1))}
        />
      }
    >
      <svg viewBox={`0 0 480 ${height}`} style={{ width: '100%', height: 'auto' }}>
        {actors.map((actor, i) => {
          const x = actorX(i, actors.length)
          return (
            <g key={actor}>
              <rect
                x={x - 40}
                y={6}
                width={80}
                height={22}
                rx={6}
                style={{ fill: 'var(--ctp-mauvesoft)', stroke: 'var(--ctp-line)' }}
              />
              <text
                x={x}
                y={21}
                textAnchor="middle"
                fontFamily="'IBM Plex Mono', monospace"
                fontSize={11}
                fontWeight={600}
                style={{ fill: 'var(--ctp-mauve)' }}
              >
                {actor}
              </text>
              <line
                x1={x}
                y1={28}
                x2={x}
                y2={lifelineBottom}
                strokeDasharray="3 3"
                style={{ stroke: 'var(--ctp-line)' }}
              />
            </g>
          )
        })}
        {steps.map((s, i) => {
          const on = i < step
          const colorName = STEP_COLOR_NAMES[i % STEP_COLOR_NAMES.length]
          const colorVar = `var(--ctp-${colorName})`
          const isRed = colorName === 'red'
          const yy = 34 + (i + 1) * 30
          const fromIndex = actorIndex.get(s.from) ?? 0
          const toIndex = actorIndex.get(s.to) ?? 0
          const x1 = actorX(fromIndex, actors.length)
          const x2 = actorX(toIndex, actors.length)

          if (s.from === s.to) {
            return (
              <g key={i} style={{ opacity: on ? 1 : 0.2, transition: 'opacity .3s' }}>
                <path
                  d={`M${x1} ${yy - 8} h26 v16 h-26`}
                  fill="none"
                  strokeWidth={1.6}
                  style={{ stroke: colorVar }}
                  markerEnd={`url(#${markerId})`}
                />
                <text
                  x={x1 + 32}
                  y={yy}
                  fontFamily="'IBM Plex Mono', monospace"
                  fontSize={10}
                  style={{ fill: 'var(--ctp-subtext0)' }}
                >
                  {s.label}
                </text>
              </g>
            )
          }

          const dir = x2 > x1 ? 1 : -1
          return (
            <g key={i} style={{ opacity: on ? 1 : 0.2, transition: 'opacity .3s' }}>
              <line
                x1={x1 + dir * 6}
                y1={yy}
                x2={x2 - dir * 6}
                y2={yy}
                strokeWidth={1.8}
                strokeDasharray={isRed ? '5 3' : undefined}
                style={{ stroke: colorVar }}
                markerEnd={`url(#${markerId})`}
              />
              <text
                x={(x1 + x2) / 2}
                y={yy - 6}
                textAnchor="middle"
                fontFamily="'IBM Plex Mono', monospace"
                fontSize={10}
                style={{ fill: isRed ? colorVar : 'var(--ctp-subtext0)' }}
              >
                {s.label}
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
