'use client'
import { useId, useRef } from 'react'
import type { Decision } from '@brief/schema'

export type TabKey = 'why' | 'cmp' | 'dia'
type CmpTableData = NonNullable<Decision['cmp']>

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line'

/**
 * A decision's why / cmp / dia under it in the dock (owner ruling D4), built
 * from parts the boards already draw: B-Reader's view-tab group, its section 03
 * table and small text. Only tabs whose field is present; nothing without any.
 * `dia` is a plain string label in the schema, not a diagram spec, so the
 * Diagram tab shows it as a caption note.
 */
export function SupportTabs({
  decision,
  picked,
  onPick,
}: {
  decision: Decision
  picked: TabKey | undefined
  onPick: (key: TabKey) => void
}) {
  const tabs: { key: TabKey; label: string }[] = []
  if (decision.why) tabs.push({ key: 'why', label: 'Explanation' })
  if (decision.cmp) tabs.push({ key: 'cmp', label: 'Compare' })
  if (decision.dia) tabs.push({ key: 'dia', label: 'Diagram' })

  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const baseId = useId()

  if (tabs.length === 0) return null
  const active = tabs.find((t) => t.key === picked)?.key ?? tabs[0]!.key

  // Left/Right move between tabs and select (ARIA APG tabs, automatic activation).
  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const at = tabs.findIndex((t) => t.key === active)
    const next = (at + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    onPick(tabs[next]!.key)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="tablist"
        aria-label={`${decision.id} details`}
        onKeyDown={handleKeyDown}
        className="flex self-start gap-[2px] rounded-[6px] border border-line bg-card p-[2px]"
      >
        {tabs.map((t, i) => {
          const selected = t.key === active
          return (
            <button
              key={t.key}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              id={`${baseId}-${t.key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onPick(t.key)}
              className={`min-h-[30px] rounded-[4px] border-0 px-[10px] text-[13px] transition-[background-color,transform] duration-[var(--dur-fast)] active:scale-[.97] motion-reduce:transition-none max-[880px]:min-h-11 ${
                selected ? 'bg-chip text-text' : 'bg-transparent text-faint hover:bg-chip'
              } ${FOCUS_RING}`}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-${active}`}>
        {active === 'why' && <p className="m-0 text-[13px] leading-5 text-sub">{decision.why}</p>}
        {active === 'cmp' && decision.cmp && <CmpTable cmp={decision.cmp} />}
        {active === 'dia' && <p className="m-0 font-mono text-[12px] leading-[18px] text-faint">[diagram: {decision.dia}]</p>}
      </div>
    </div>
  )
}

/** B-Reader's section 03 table: line border radius 4, elev head in `sub`, 8 10 cells, line between rows. */
function CmpTable({ cmp }: { cmp: CmpTableData }) {
  return (
    <div className="overflow-x-auto rounded-[4px] border border-line">
      <table className="w-full border-collapse text-[13px] leading-5">
        <thead>
          <tr className="bg-elev text-left text-sub">
            {cmp.head.map((cell, i) => (
              <th key={i} scope="col" className="px-[10px] py-2 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cmp.rows.map((row, ri) => (
            <tr key={ri} className="border-t border-line">
              {row.map((cell, ci) =>
                ci === 0 ? (
                  <th key={ci} scope="row" className="px-[10px] py-2 text-left font-normal">
                    {cell}
                  </th>
                ) : (
                  <td key={ci} className="px-[10px] py-2">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
