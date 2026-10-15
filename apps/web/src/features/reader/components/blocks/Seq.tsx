'use client'
import { useEffect, useMemo, useReducer } from 'react'
import type { KeyboardEvent } from 'react'
import type { Block } from '@brief/schema'
import { BlockCard, cardHeader } from '../BlockCard'
import type { BlockAnchor } from '../blockAnchor'
import { useDiagramFullScreen } from '../fullScreen'
import { FOCUS_RING } from '../topbarChrome'
import { computeSeqLayout, LINE_HEIGHT, SELF_LOOP_WIDTH } from '../../lib/seqLayout'
import { Edge, EDGE_TONE, EdgeLayer } from './diagramParts'

type SeqBlock = Extract<Block, { type: 'seq' }>

/**
 * How long playback rests on each step: the 1.6s the app already gives a short
 * line to be read (toast, features.md O6; section flash, interactions.md).
 * No board or token names a playback dwell.
 */
export const PLAYBACK_STEP_MS = 1600

/** `cursor` null is the diagram at rest: every step drawn, none current (B-Reader:126-139). */
interface Playback {
  cursor: number | null
  playing: boolean
}

type PlaybackAction = 'play' | 'pause' | 'prev' | 'next' | 'tick'

function playbackReducer(count: number) {
  return (state: Playback, action: PlaybackAction): Playback => {
    switch (action) {
      case 'play':
        return { cursor: state.cursor === null || state.cursor >= count ? 1 : state.cursor, playing: true }
      case 'pause':
        return { ...state, playing: false }
      case 'prev':
        return { cursor: state.cursor === null ? null : Math.max(1, state.cursor - 1), playing: false }
      case 'next':
        return { cursor: state.cursor === null ? 1 : Math.min(count, state.cursor + 1), playing: false }
      case 'tick': {
        const cursor = Math.min(count, (state.cursor ?? 0) + 1)
        return { cursor, playing: cursor < count }
      }
    }
  }
}

type Phase = 'rest' | 'past' | 'current' | 'future'

function phaseOf(index: number, cursor: number | null): Phase {
  if (cursor === null) return 'rest'
  const n = index + 1
  return n < cursor ? 'past' : n === cursor ? 'current' : 'future'
}

/**
 * Edge colors per phase (B-Blocks:83-88 while stepping, B-Reader:130-135 at
 * rest, where requests are `sub` and replies `faint`). Paper shows every step
 * at once in the text color (B-Print:46-49).
 */
function edgeClass(phase: Phase, reply: boolean): string {
  const tone =
    phase === 'current'
      ? EDGE_TONE.accent
      : phase === 'future'
        ? EDGE_TONE.line2
        : phase === 'past' || reply
          ? EDGE_TONE.faint
          : EDGE_TONE.sub
  return `${tone} print:fill-text! print:stroke-text!`
}

const LABEL_CLASS: Record<Phase, string> = {
  rest: 'text-sub',
  past: 'text-sub',
  current: 'text-accent-text',
  future: 'text-faint',
}

/** The step list row (B-Blocks:102-107; B-Mobile:37-40 on phones). */
const ROW_CLASS: Record<Phase, string> = {
  rest: 'px-2.5 py-2 text-sub max-[880px]:p-0',
  past: 'px-2.5 py-2 text-sub max-[880px]:p-0',
  current:
    'rounded-[4px] border border-[var(--c-step-line)] bg-accent-soft px-2.5 py-2 text-text max-[880px]:px-2 max-[880px]:py-1.5',
  future: 'px-2.5 py-2 text-faint max-[880px]:p-0',
}

/** The agent's sentence for the step (B-Blocks:102-107), else "from → to: label". */
function stepText(step: SeqBlock['steps'][number]): string {
  return step.text ?? `${step.from} → ${step.to}: ${step.label}`
}

function Chevron({ dir, strokeWidth = 2 }: { dir: 'left' | 'right'; strokeWidth?: number }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
    </svg>
  )
}

const CONTROL = `flex size-8 shrink-0 items-center justify-center rounded-[4px] transition-[background-color,transform] duration-[var(--dur-fast)] enabled:active:scale-[.97] disabled:opacity-45 motion-reduce:transition-none max-[880px]:size-11 ${FOCUS_RING}`
const BORDERED = 'border border-line2 bg-elev text-text enabled:hover:bg-chip'
const FILLED = 'bg-accent text-on-accent'

interface SeqDiagramProps {
  block: SeqBlock
  cursor: number | null
}

function SeqDiagram({ block, cursor }: SeqDiagramProps) {
  const layout = useMemo(() => computeSeqLayout(block.actors, block.steps), [block.actors, block.steps])
  const current = cursor === null ? undefined : block.steps[cursor - 1]

  return (
    <div
      className={`relative font-mono text-[12px] leading-4 ${cursor === null ? 'mx-auto' : ''}`}
      style={{ width: layout.width, height: layout.height }}
    >
      <EdgeLayer width={layout.width} height={layout.height}>
        {layout.actors.map((actor, i) => (
          <path
            key={i}
            d={`M${actor.x} ${layout.actorHeight} V${layout.lifelineBottom}`}
            fill="none"
            strokeWidth={1.5}
            strokeDasharray="3 4"
            className="stroke-line2 print:stroke-faint!"
          />
        ))}
        {layout.steps.map((s, i) => {
          const phase = phaseOf(i, cursor)
          const points = s.self
            ? [
                { x: s.x1, y: s.y },
                { x: s.x1 + SELF_LOOP_WIDTH, y: s.y },
                { x: s.x1 + SELF_LOOP_WIDTH, y: s.y + LINE_HEIGHT },
                { x: s.x1 + 1, y: s.y + LINE_HEIGHT },
              ]
            : [
                { x: s.x1, y: s.y },
                { x: s.x2, y: s.y },
              ]
          return (
            <Edge
              key={i}
              points={points}
              dashed={s.reply}
              dataState={phase}
              className={`${edgeClass(phase, s.reply)} transition-[stroke,fill] duration-[var(--dur-base)] motion-reduce:transition-none`}
            />
          )
        })}
      </EdgeLayer>
      {layout.actors.map((actor, i) => {
        const active = current !== undefined && (current.from === actor.name || current.to === actor.name)
        return (
          <div
            key={i}
            data-actor=""
            className={`absolute top-0 box-border flex items-center justify-center rounded-[4px] border bg-elev px-1.5 text-center font-sans text-[13px] font-medium text-text print:border-text! ${
              active ? 'border-accent-line' : 'border-line2'
            }`}
            style={{ left: actor.x - 65, width: 130, height: layout.actorHeight }}
          >
            {actor.name}
          </div>
        )
      })}
      {layout.steps.map((s, i) => (
        <div
          key={i}
          data-seq-label=""
          className={`absolute whitespace-pre print:text-text! ${s.centered ? 'text-center' : ''} ${LABEL_CLASS[phaseOf(i, cursor)]}`}
          style={{ left: s.labelLeft, top: s.labelTop, width: s.labelWidth }}
        >
          {s.lines.join('\n')}
        </div>
      ))}
    </div>
  )
}

/**
 * Sequence diagram block with playback (features.md B4, B-Blocks:74-110).
 *
 * At rest every message is drawn, centered (B-Reader:126-139). Play, or a
 * step, starts playback: the current message is lime, earlier ones faint,
 * later ones line2, and the step list wraps beside the left-aligned diagram,
 * under it when the card is too narrow for both (B-Blocks:76-101). On phones
 * the list replaces the diagram, and the full-screen button opens the full
 * picture (B-Mobile:35-42).
 * Paper prints every message at once, numbered (B-Print:41-53).
 *
 * Steps referencing an actor name not present in `actors` are dropped
 * defensively rather than crashing on an undefined lane.
 */
export function Seq({ block, ...anchor }: { block: SeqBlock } & BlockAnchor) {
  const steps = useMemo(() => {
    const known = new Set(block.actors)
    return block.steps.filter((s) => known.has(s.from) && known.has(s.to))
  }, [block.actors, block.steps])
  const drawn = useMemo(() => ({ ...block, steps }), [block, steps])
  const count = steps.length

  const reducer = useMemo(() => playbackReducer(count), [count])
  const [state, dispatch] = useReducer(reducer, { cursor: null, playing: false })
  // A live edit can drop steps under the cursor; it then stands on the last one.
  const cursor = state.cursor === null || count === 0 ? null : Math.min(state.cursor, count)
  const playing = state.playing && count > 0

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => dispatch('tick'), PLAYBACK_STEP_MS)
    return () => clearTimeout(timer)
  }, [playing, cursor])

  const currentStep = cursor === null ? undefined : steps[cursor - 1]
  const canPrev = cursor !== null && cursor > 1
  const canNext = count > 0 && (cursor === null || cursor < count)

  const diagram = <SeqDiagram block={drawn} cursor={cursor} />
  const onFullScreen = useDiagramFullScreen(diagram, {
    heading: { kind: block.type, title: block.title },
    steps: {
      label: `${cursor ?? 0} / ${count}`,
      text: currentStep ? stepText(currentStep) : '',
      onPrev: canPrev ? () => dispatch('prev') : undefined,
      onNext: canNext ? () => dispatch('next') : undefined,
    },
  })

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (count === 0 || event.metaKey || event.ctrlKey || event.altKey) return
    const action =
      event.key === 'ArrowLeft'
        ? 'prev'
        : event.key === 'ArrowRight'
          ? 'next'
          : event.key === ' ' && event.target === event.currentTarget
            ? playing
              ? 'pause'
              : 'play'
            : null
    if (!action) return
    event.preventDefault()
    dispatch(action)
  }

  const atRest = cursor === null
  const controls = (
    <div className="flex items-center gap-2 print:hidden max-[880px]:gap-1.5" onKeyDown={onKeyDown}>
      {atRest ? null : (
        <>
          <span className="shrink-0 text-accent-text max-[880px]:hidden">
            step {cursor} / {count}
          </span>
          <span className="hidden shrink-0 max-[880px]:inline">
            step {cursor} of {count}
          </span>
        </>
      )}
      <button
        type="button"
        aria-label="Previous step"
        disabled={!canPrev}
        onClick={() => dispatch('prev')}
        className={`${CONTROL} ${BORDERED} max-[880px]:border-0 max-[880px]:bg-transparent ${atRest ? 'min-[880px]:hidden' : ''}`}
      >
        <Chevron dir="left" />
      </button>
      <button
        type="button"
        aria-label={playing ? 'Pause' : 'Play sequence'}
        disabled={count === 0}
        onClick={() => dispatch(playing ? 'pause' : 'play')}
        className={`${CONTROL} ${FILLED} max-[880px]:hidden`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={playing ? 'M6 4h4v16H6zM14 4h4v16h-4z' : 'M7 5l12 7-12 7z'} />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Next step"
        disabled={!canNext}
        onClick={() => dispatch('next')}
        className={`${CONTROL} ${BORDERED} max-[880px]:border-0 max-[880px]:bg-accent max-[880px]:text-on-accent ${atRest ? 'min-[880px]:hidden' : ''}`}
      >
        <Chevron dir="right" />
      </button>
    </div>
  )

  return (
    <BlockCard
      {...cardHeader(block, anchor)}
      captionSuffix={`${count} ${count === 1 ? 'message' : 'messages'}`}
      controls={controls}
      fullScreen={onFullScreen}
    >
      <div role="group" aria-label="Sequence steps" tabIndex={0} onKeyDown={onKeyDown} className={`outline-none ${FOCUS_RING}`}>
        {/* The 1px gap shows the line color: the board's rule between the pane
            and the list, whether they share a row or the list wraps under. */}
        <div className="flex flex-wrap gap-px bg-line">
          <div
            className={`min-w-0 flex-[1_1_660px] overflow-x-auto bg-card max-[880px]:hidden print:block! ${atRest ? 'py-4' : 'px-2.5 py-5'}`}
          >
            {diagram}
          </div>
          <ol
            className={`m-0 min-w-0 flex-[1_1_300px] list-none flex-col gap-1 bg-card p-2.5 text-[13px] leading-[normal] print:hidden! max-[880px]:flex max-[880px]:gap-1.5 max-[880px]:p-3 ${
              atRest ? 'hidden' : 'flex'
            }`}
          >
            {steps.map((s, i) => {
              const phase = phaseOf(i, cursor)
              return (
                <li
                  key={i}
                  aria-current={phase === 'current' ? 'step' : undefined}
                  className={`grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1 max-[880px]:gap-x-2 ${ROW_CLASS[phase]}`}
                >
                  <span className={`font-mono ${phase === 'current' ? 'text-accent-text' : ''}`}>{i + 1}</span>
                  <span>{stepText(s)}</span>
                  {phase === 'current' && s.note ? (
                    <span className="col-start-2 text-[12px] leading-[18px] text-sub">{s.note}</span>
                  ) : null}
                </li>
              )
            })}
          </ol>
        </div>
        <span className="sr-only" aria-live="polite">
          {currentStep ? `Step ${cursor} of ${count}: ${stepText(currentStep)}` : ''}
        </span>
      </div>
    </BlockCard>
  )
}
