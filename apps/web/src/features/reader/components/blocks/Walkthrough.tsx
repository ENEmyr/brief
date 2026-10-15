'use client'
import { useMemo, useState } from 'react'
import type { WalkthroughBlock } from '@brief/schema'
import { useReaderState } from '@/features/reader-state'
import { BlockCard, cardHeader } from '../BlockCard'
import type { BlockAnchor } from '../blockAnchor'
import { FOCUS_RING } from '../topbarChrome'
import { walkthroughModel, type FlowBox } from '../../lib/walkthroughModel'
import { CodePanel, CodeRow, useHighlightedCode } from './CodePre'
import { Edge, EDGE_TONE, EdgeLayer } from './diagramParts'
import { BORDERED, Chevron, CONTROL, FILLED } from './Seq'

type Phase = 'current' | 'past' | 'future'

function phaseOf(step: number | null, current: number): Phase {
  if (step === current) return 'current'
  return step !== null && step < current ? 'past' : 'future'
}

/** B-NewBlocks:52-54: the picked hunk is tinted with a lime bar; earlier hunks keep a dim bar. */
const HUNK_CLASS: Record<Phase, { row: string; bar: string; caption: string }> = {
  current: { row: 'bg-accent-soft', bar: 'bg-accent', caption: 'text-accent-text' },
  past: { row: 'hover:bg-elev', bar: 'bg-[var(--c-step-line)]', caption: 'text-faint' },
  future: { row: 'hover:bg-elev', bar: 'bg-transparent', caption: 'text-faint' },
}

const STEP_NUMBER = new Intl.NumberFormat('en', { minimumIntegerDigits: 2 })

function nodeClass(box: FlowBox, current: boolean): string {
  switch (box.kind) {
    case 'start':
      return 'rounded-full bg-text font-sans text-[13px] font-semibold text-page'
    case 'end':
      return 'rounded-full bg-good font-sans text-[13px] font-semibold text-page'
    case 'decision':
      return `font-mono text-[12px] font-medium [clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)] ${
        current ? 'bg-accent text-on-accent' : 'bg-line2 text-text'
      }`
    case 'step':
      return `rounded-[4px] border p-2 font-mono text-[12px] text-text ${
        current ? 'border-accent-line bg-accent-soft' : 'border-line2 bg-elev'
      }`
  }
}

export function Walkthrough({
  block,
  pathPrefix = '',
  ...anchor
}: { block: WalkthroughBlock } & BlockAnchor) {
  const model = useMemo(() => walkthroughModel(block), [block])
  const [current, setCurrent] = useState(0)
  const highlighted = useHighlightedCode(block.code, block.language)
  const { highlights } = useReaderState()
  const count = block.steps.length
  const shown = model.revealed[current] ?? new Set<string>()
  const active = new Set(block.steps[current]?.nodes)

  function pickFromRows(step: number | null) {
    if (step === null) return
    if (!(getSelection()?.isCollapsed ?? true)) return
    setCurrent(step)
  }

  const caption = (step: number) => {
    const phase = phaseOf(step, current)
    return (
      <button
        key={`caption-${step}`}
        type="button"
        aria-pressed={step === current}
        onClick={() => setCurrent(step)}
        className={`block w-full select-none pl-7 text-left font-sans text-[12px] ${HUNK_CLASS[phase].caption} ${FOCUS_RING}`}
      >
        {`${STEP_NUMBER.format(step + 1)} ${block.steps[step]!.title}`}
      </button>
    )
  }

  const controls = (
    <div className="flex items-center gap-2 print:hidden max-[880px]:gap-1.5">
      <button
        type="button"
        aria-label="Previous hunk"
        disabled={current === 0}
        onClick={() => setCurrent((c) => Math.max(0, c - 1))}
        className={`${CONTROL} ${BORDERED}`}
      >
        <Chevron dir="left" />
      </button>
      <button
        type="button"
        aria-label="Next hunk"
        disabled={current >= count - 1}
        onClick={() => setCurrent((c) => Math.min(count - 1, c + 1))}
        className={`${CONTROL} ${FILLED}`}
      >
        <Chevron dir="right" strokeWidth={2.25} />
      </button>
    </div>
  )

  return (
    <BlockCard
      {...cardHeader(block, { ...anchor, pathPrefix })}
      captionSuffix={block.filename === undefined ? undefined : block.title}
      meta={<span className="ml-3 shrink-0 text-text max-[880px]:ml-1">{`hunk ${current + 1} / ${count}`}</span>}
      controls={controls}
    >
      <div className="flex max-[880px]:flex-col">
        <div className="min-w-0 flex-1 border-r border-line max-[880px]:border-r-0 max-[880px]:border-b">
          <CodePanel highlighted={highlighted} className="py-2.5 text-[13px] leading-[22px]">
            {model.segments.map((segment) => {
              const phase = phaseOf(segment.owner, current)
              const style = segment.owner === null ? undefined : HUNK_CLASS[phase]
              return (
                <span
                  key={segment.start}
                  data-hunk={segment.owner ?? undefined}
                  onClick={() => pickFromRows(segment.owner)}
                  className={`flex transition-[background-color] duration-[var(--dur-fast)] motion-reduce:transition-none ${
                    segment.owner === null ? '' : `cursor-pointer py-1.5 ${style!.row}`
                  }`}
                >
                  <span aria-hidden="true" className={`w-[3px] shrink-0 select-none ${style?.bar ?? ''}`} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    {model.lines.slice(segment.start, segment.end).map((text, j) => {
                      const i = segment.start + j
                      return (
                        <CodeRow
                          key={i}
                          node={highlighted?.lines[i]}
                          text={text}
                          number={i + 1}
                          gutter="w-[28px]"
                          inset="pl-2.5 pr-3"
                          path={`${pathPrefix}code.${i}`}
                          annotatable={anchor.annotatable ?? true}
                          highlights={highlights}
                          sid={anchor.sid}
                          bid={anchor.bid}
                          onMarkClick={anchor.onMarkClick}
                        />
                      )
                    })}
                    {segment.captions.map((step) => (
                      <span key={step} className="block pl-2.5 pr-3">
                        {caption(step)}
                      </span>
                    ))}
                  </span>
                </span>
              )
            })}
            {model.unplaced.map((step) => (
              <span key={`unplaced-${step}`} className="block py-1.5 pl-[13px] pr-3">
                {caption(step)}
              </span>
            ))}
          </CodePanel>
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto bg-[var(--c-code-bg)] px-2.5 py-4">
          <div
            data-flow=""
            className="relative mx-auto text-[13px] leading-[18px]"
            style={{ width: model.width, height: model.height }}
          >
            <EdgeLayer width={model.width} height={model.height}>
              {model.edges
                .filter((e) => shown.has(e.from) && shown.has(e.to))
                .map((e) => (
                  <Edge key={`${e.from}-${e.to}`} points={e.points} className={EDGE_TONE.faint} />
                ))}
            </EdgeLayer>
            {model.edges
              .filter((e) => e.labelAt && shown.has(e.from) && shown.has(e.to))
              .map((e) => (
                <span
                  key={`label-${e.from}-${e.to}`}
                  className="absolute whitespace-pre font-mono text-[12px] leading-4 text-faint"
                  style={{
                    left: e.labelAt!.x,
                    top: e.labelAt!.y,
                    transform: e.labelAt!.align === 'center' ? 'translateX(-50%)' : undefined,
                  }}
                >
                  {e.label}
                </span>
              ))}
            {[...model.boxes.values()]
              .filter((box) => shown.has(box.id))
              .map((box) => (
                <div
                  key={box.id}
                  data-node={box.id}
                  data-current={active.has(box.id) ? '' : undefined}
                  className={`absolute box-border flex items-center justify-center overflow-hidden break-words text-center ${nodeClass(box, active.has(box.id))}`}
                  style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
                >
                  {box.label}
                </div>
              ))}
          </div>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        {`hunk ${current + 1} of ${count}: ${block.steps[current]?.title ?? ''}`}
      </span>
    </BlockCard>
  )
}
