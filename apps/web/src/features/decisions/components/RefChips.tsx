'use client'
import type { Decision, StoredSection } from '@brief/schema'
import { resolveRefs } from '../lib/refs'

const pad = (n: number) => String(n).padStart(2, '0')

/** Called with the section a context chip names and the decision it sits in. */
export type JumpToContext = (sectionId: string, decisionId: string) => void

const CHIP = {
  dock: 'min-h-[26px] gap-[5px] px-[7px] text-[12px]',
  sheet: 'min-h-9 gap-[6px] px-[10px] text-[13px]',
}

/**
 * A decision's context chips (D7), a chip per section it refers to; nothing
 * renders when no ref resolves. The dock draws them after a "context" label
 * (B-Reader:214), the sheet as links above the options (B-Mobile:77). Under
 * 880 a chip is 44 high where the boards draw 26 and 36: every target under
 * 880 is at least 44.
 */
export function RefChips({
  decision,
  sections,
  onJump,
  variant,
}: {
  decision: Decision
  sections: readonly StoredSection[]
  onJump: JumpToContext
  variant: 'dock' | 'sheet'
}) {
  const refs = resolveRefs(decision, sections)
  if (refs.length === 0) return null
  return (
    <div
      data-refs=""
      className={`flex flex-wrap items-center leading-[normal] ${variant === 'dock' ? '-mt-[2px] gap-1' : '-mt-1 gap-[6px]'}`}
    >
      {variant === 'dock' && <span className="mr-[2px] font-mono text-[10px] text-faint">context</span>}
      {refs.map((ref) => (
        <a
          key={ref.id}
          href={`#${ref.id}`}
          onClick={(event) => {
            event.preventDefault()
            onJump(ref.id, decision.id)
          }}
          className={`flex items-center rounded-[4px] border border-line2 ${CHIP[variant]} text-sub no-underline transition-colors duration-[var(--dur-fast)] hover:bg-chip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line motion-reduce:transition-none max-[880px]:min-h-11`}
        >
          <span className="font-mono text-[11px] text-accent-text">§{pad(ref.no)}</span>
          {ref.title}
        </a>
      ))}
    </div>
  )
}
