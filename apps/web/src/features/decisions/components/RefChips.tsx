'use client'
import type { Decision, StoredSection } from '@brief/schema'
import { resolveRefs } from '../lib/refs'

const pad = (n: number) => String(n).padStart(2, '0')

/** Called with the section a context chip names and the decision it sits in. */
export type JumpToContext = (sectionId: string, decisionId: string) => void

/**
 * The "context" row of a decision (B-Reader:214, D7): a chip per section the
 * decision refers to. Nothing renders when no ref resolves. Under 880 a chip
 * is 44 high where the board draws 26: every target under 880 is at least 44.
 */
export function RefChips({
  decision,
  sections,
  onJump,
}: {
  decision: Decision
  sections: readonly StoredSection[]
  onJump: JumpToContext
}) {
  const refs = resolveRefs(decision, sections)
  if (refs.length === 0) return null
  return (
    <div data-refs="" className="-mt-[2px] flex flex-wrap items-center gap-1 leading-[normal]">
      <span className="mr-[2px] font-mono text-[10px] text-faint">context</span>
      {refs.map((ref) => (
        <a
          key={ref.id}
          href={`#${ref.id}`}
          onClick={(event) => {
            event.preventDefault()
            onJump(ref.id, decision.id)
          }}
          className="flex min-h-[26px] items-center gap-[5px] rounded-[4px] border border-line2 px-[7px] text-[12px] text-sub no-underline transition-colors duration-[var(--dur-fast)] hover:bg-chip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line motion-reduce:transition-none max-[880px]:min-h-11"
        >
          <span className="font-mono text-[11px] text-accent-text">§{pad(ref.no)}</span>
          {ref.title}
        </a>
      ))}
    </div>
  )
}
