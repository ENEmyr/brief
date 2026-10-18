'use client'
import { useEffect, useId, useRef, useState } from 'react'
import type { Decision } from '@brief/schema'
import { useReaderActions, useReaderState } from '@/features/reader-state'
import { useShortcuts } from '@/features/shortcuts'
import { otherPicked } from '../lib/answers'

export type DockVariant = 'dock' | 'sheet'

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line'

/**
 * B-Reader's dock and B-Mobile's sheet. The boards size the kbd and the Other
 * input as content boxes, so a "height: 18px" kbd with its border renders 20
 * and a "min-height: 34px" input 36; these are the rendered sizes.
 */
const VARIANTS: Record<
  DockVariant,
  { group: string; option: string; idle: string; kbd: string; other: string }
> = {
  dock: {
    group: 'gap-1',
    option: 'min-h-[34px] gap-[10px] rounded-[4px] px-2 text-[13px]',
    idle: 'border-line bg-card text-sub hover:bg-chip',
    kbd: 'h-5 min-w-5 rounded-[3px] text-[11px]',
    other: 'console-rise min-h-9 rounded-[4px] px-[10px]',
  },
  sheet: {
    group: 'gap-[6px]',
    option: 'min-h-12 gap-3 rounded-[6px] px-3 text-[15px] leading-[normal]',
    idle: 'border-line bg-[var(--c-code-bg)] text-sub',
    kbd: 'h-6 w-6 shrink-0 rounded-[4px] text-[12px]',
    other: 'min-h-[46px] rounded-[6px] px-3',
  },
}

interface Item {
  key: string
  label: string
  detail?: string
  on: boolean
  other: boolean
}

/**
 * A decision's options plus "Other": a radiogroup for a single-select, a group
 * of checkboxes for a multi-select (interactions.md). Each row carries its
 * number; 1 to 9 pick it while focus is in this decision, the last number is
 * Other. Picking Other reveals "Your answer" under the group and focuses it.
 */
export function OptionList({
  decision,
  variant,
  labelledBy,
}: {
  decision: Decision
  variant: DockVariant
  labelledBy: string
}) {
  const state = useReaderState()
  const actions = useReaderActions()
  const groupRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const otherRef = useRef<HTMLInputElement>(null)
  const [focusOther, setFocusOther] = useState(false)
  const detailId = useId()
  const look = VARIANTS[variant]
  const radio = !decision.multi

  const selected = state.dsel[decision.id] ?? []
  const otherOn = otherPicked(decision.id, state)
  const items: Item[] = [
    ...decision.opts.map((opt) => ({
      key: `o:${opt.id}`,
      label: opt.label,
      ...(opt.detail ? { detail: opt.detail } : {}),
      on: selected.includes(opt.id),
      other: false,
    })),
    { key: 'other', label: 'Other, type your own', on: otherOn, other: true },
  ]

  useEffect(() => {
    if (!focusOther) return
    setFocusOther(false)
    otherRef.current?.focus()
  }, [focusOther])

  /** `typeInto`: a click or a number key moves focus into "Your answer"; an arrow key stays on the radio. */
  function choose(index: number, typeInto: boolean) {
    const item = items[index]
    if (!item) return
    if (item.other) actions.pickOther(decision.id, decision.multi)
    else actions.pickOption(decision.id, decision.opts[index]!.id, decision.multi)
    const opensField = item.other && typeInto && (radio || !item.on)
    if (opensField) setFocusOther(true)
    else optionRefs.current[index]?.focus()
  }

  useShortcuts({
    pickOption: (key) => {
      const row = groupRef.current?.closest('[data-decision]')
      if (!row?.contains(document.activeElement)) return false
      choose(Number(key) - 1, true)
    },
  })

  // A radiogroup is one tab stop: the checked option, else the first.
  const checkedAt = items.findIndex((item) => item.on)
  const tabStop = checkedAt === -1 ? 0 : checkedAt

  function handleKeyDown(event: React.KeyboardEvent) {
    if (!radio) return
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    if (step === undefined) return
    event.preventDefault()
    const from = optionRefs.current.findIndex((el) => el === document.activeElement)
    choose(((from === -1 ? tabStop : from) + step + items.length) % items.length, false)
  }

  return (
    <>
      <div
        ref={groupRef}
        role={radio ? 'radiogroup' : 'group'}
        aria-labelledby={labelledBy}
        onKeyDown={handleKeyDown}
        className={`flex flex-col ${look.group}`}
      >
        {items.map((item, i) => (
          <button
            key={item.key}
            ref={(el) => {
              optionRefs.current[i] = el
            }}
            type="button"
            role={radio ? 'radio' : 'checkbox'}
            aria-checked={item.on}
            aria-label={item.label}
            aria-describedby={item.detail ? `${detailId}-${i}` : undefined}
            aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
            tabIndex={radio && i !== tabStop ? -1 : 0}
            onClick={() => choose(i, true)}
            className={`flex items-center border text-left transition-colors duration-[var(--dur-fast)] motion-reduce:transition-none ${look.option} ${
              item.on ? 'border-accent-line bg-accent-soft text-text' : look.idle
            } ${FOCUS_RING}`}
          >
            <kbd
              aria-hidden="true"
              className={`flex items-center justify-center border font-mono ${look.kbd} ${
                item.on
                  ? 'border-accent-line bg-accent text-on-accent'
                  : 'border-line2 bg-transparent text-sub'
              }`}
            >
              {i + 1}
            </kbd>
            <span className="grow">
              {item.label}
              {item.detail && (
                <span
                  id={`${detailId}-${i}`}
                  className="block text-[12px] leading-[18px] text-faint"
                >
                  {item.detail}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
      {otherOn && (
        <input
          ref={otherRef}
          value={state.dother[decision.id] ?? ''}
          onChange={(event) => actions.setOtherText(decision.id, event.target.value)}
          aria-label={variant === 'dock' ? `${decision.id} Your answer` : 'Your answer'}
          placeholder="Your answer"
          className={`border border-accent-line bg-page text-[16px] text-text outline-none ${look.other} ${FOCUS_RING}`}
        />
      )}
    </>
  )
}
