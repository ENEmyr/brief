'use client'
import { useId, useMemo, useState } from 'react'
import type { Block } from '@brief/schema'
import { DiagramCard } from '../DiagramCard'
import { titleCaption } from '../blockAnchor'
import type { BlockAnchor } from '../blockAnchor'
import {
  ACTOR_FONT_SIZE,
  computeSeqLayout,
  LABEL_FONT_SIZE,
  LINE_HEIGHT,
  PILL_HEIGHT,
  PILL_Y,
  SELF_LOOP_WIDTH,
  type SeqStepLayout,
} from '../../lib/seqLayout'
import { svgTextStyle } from '../../lib/svgText'

type SeqBlock = Extract<Block, { type: 'seq' }>

// Cycled per visible step (not per actor). When the cycled name lands on
// 'red' the arrow gets a dashed stroke and the label is colored red too,
// matching the prototype's explicit per-step color tagging.
const STEP_COLOR_NAMES = ['blue', 'mauve', 'green', 'red', 'teal'] as const

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

/** A wrapped label: one <tspan> per line, re-anchored at x so it stays aligned. */
function StepLabel({ step, fill }: { step: SeqStepLayout; fill: string }) {
  return (
    <text
      x={step.labelX}
      y={step.labelY}
      textAnchor={step.centered ? 'middle' : 'start'}
      fontSize={LABEL_FONT_SIZE}
      style={svgTextStyle({ fill })}
    >
      {step.lines.map((line, i) => (
        <tspan key={i} x={step.labelX} dy={i === 0 ? 0 : LINE_HEIGHT}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

/**
 * Sequence diagram block: n actors, n schema-driven steps, and a Prev/Next
 * control that reveals the steps one at a time.
 *
 * All geometry comes from `computeSeqLayout`, which sizes the diagram to its
 * content. The svg renders at that natural size with `max-width: 100%`, so a
 * wide diagram is scaled down into the column but a small one is never scaled
 * up. The old fixed 480-unit viewBox at `width: 100%` was a ~1.8x upscale in
 * the reader's column, which is why the labels used to dwarf the body copy.
 *
 * Steps referencing an actor name not present in `actors` are dropped
 * defensively rather than crashing on an undefined x position.
 */
export function Seq({ block, ...anchor }: { block: SeqBlock } & BlockAnchor) {
  const markerId = useId()
  const actors = block.actors
  const blockSteps = block.steps
  const steps = useMemo(() => {
    const known = new Set(actors)
    return blockSteps.filter((s) => known.has(s.from) && known.has(s.to))
  }, [actors, blockSteps])
  const [step, setStep] = useState(steps.length)

  const layout = useMemo(() => computeSeqLayout(actors, steps), [actors, steps])

  return (
    <DiagramCard
      {...titleCaption(anchor, block.title, 'Sequence')}
      controls={
        <SeqControls
          step={step}
          max={steps.length}
          onPrev={() => setStep((s) => Math.max(0, s - 1))}
          onNext={() => setStep((s) => Math.min(steps.length, s + 1))}
        />
      }
    >
      <svg
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        style={{ display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' }}
      >
        {layout.actors.map((actor) => (
          <g key={actor.name}>
            <rect
              x={actor.x - actor.pillWidth / 2}
              y={PILL_Y}
              width={actor.pillWidth}
              height={PILL_HEIGHT}
              rx={6}
              style={{ fill: 'var(--ctp-mauvesoft)', stroke: 'var(--ctp-line)' }}
            />
            <text
              x={actor.x}
              y={PILL_Y + PILL_HEIGHT / 2 + 4}
              textAnchor="middle"
              fontSize={ACTOR_FONT_SIZE}
              fontWeight={600}
              style={svgTextStyle({ fill: 'var(--ctp-mauve)' })}
            >
              {actor.name}
            </text>
            <line
              x1={actor.x}
              y1={PILL_Y + PILL_HEIGHT}
              x2={actor.x}
              y2={layout.lifelineBottom}
              strokeDasharray="3 3"
              style={{ stroke: 'var(--ctp-line)' }}
            />
          </g>
        ))}
        {layout.steps.map((s, i) => {
          const on = i < step
          const colorName = STEP_COLOR_NAMES[i % STEP_COLOR_NAMES.length]
          const colorVar = `var(--ctp-${colorName})`
          const isRed = colorName === 'red'

          if (s.self) {
            return (
              <g key={i} style={{ opacity: on ? 1 : 0.2, transition: 'opacity .3s' }}>
                <path
                  d={`M${s.x1} ${s.y - 8} h${SELF_LOOP_WIDTH} v16 h-${SELF_LOOP_WIDTH}`}
                  fill="none"
                  strokeWidth={1.6}
                  style={{ stroke: colorVar }}
                  markerEnd={`url(#${markerId})`}
                />
                <StepLabel step={s} fill="var(--ctp-subtext0)" />
              </g>
            )
          }

          const dir = s.x2 > s.x1 ? 1 : -1
          return (
            <g key={i} style={{ opacity: on ? 1 : 0.2, transition: 'opacity .3s' }}>
              <line
                x1={s.x1 + dir * 6}
                y1={s.y}
                x2={s.x2 - dir * 6}
                y2={s.y}
                strokeWidth={1.8}
                strokeDasharray={isRed ? '5 3' : undefined}
                style={{ stroke: colorVar }}
                markerEnd={`url(#${markerId})`}
              />
              <StepLabel step={s} fill={isRed ? colorVar : 'var(--ctp-subtext0)'} />
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
