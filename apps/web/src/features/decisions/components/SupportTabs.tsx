'use client'
import { useState } from 'react'
import type { Decision } from '@brief/schema'

type TabKey = 'why' | 'cmp' | 'dia'
type CmpTableData = NonNullable<Decision['cmp']>

/** Support tabs for a decision's why/cmp/dia fields (Reader.dc.html
 * 799-828): a tab strip with only the tabs whose data is present on this
 * decision (active tab mauvesoft bg + mauve text), a body with elev
 * background inside a rounded/line2-bordered container. Renders null when
 * the decision has none of why/cmp/dia.
 *
 * Deviation from the prototype: the prototype always shows an "Explanation"
 * tab (its mock data happened to give every decision a `why`); the brief
 * calls for tabs "only when data present", so the why tab is conditional
 * here too, matching cmp/dia.
 *
 * Deviation from the prototype: `dia` in this schema is a plain string
 * label, not a diagram spec (the prototype's supportDia rendered an SVG
 * mock). Per the adjudicated simplification, the Diagram tab renders a mono
 * caption note instead: "[diagram: {label}]".
 *
 * Tab selection is remembered per decision id (a local
 * Record<decisionId, TabKey>) so switching between stepper questions and
 * back restores the tab the user was on, matching the prototype's
 * `this._tab[decision.id]` memory. */
export function SupportTabs({ decision }: { decision: Decision }) {
  const [tabByDecision, setTabByDecision] = useState<Record<string, TabKey>>({})

  const tabs: { key: TabKey; label: string }[] = []
  if (decision.why) tabs.push({ key: 'why', label: 'Explanation' })
  if (decision.cmp) tabs.push({ key: 'cmp', label: 'Compare' })
  if (decision.dia) tabs.push({ key: 'dia', label: 'Diagram' })

  if (tabs.length === 0) return null

  const firstKey = tabs[0]!.key
  const stored = tabByDecision[decision.id]
  const active = stored && tabs.some((t) => t.key === stored) ? stored : firstKey

  function selectTab(key: TabKey) {
    setTabByDecision((prev) => ({ ...prev, [decision.id]: key }))
  }

  return (
    <div className="mt-3 overflow-hidden rounded-[10px] border border-line2 bg-elev">
      <div role="tablist" className="flex gap-0.5 border-b border-line2 p-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => selectTab(t.key)}
            className={`max-[879px]:min-h-11 rounded-[7px] px-3 py-[5px] font-[inherit] text-[12.5px] ${
              active === t.key ? 'bg-mauvesoft font-semibold text-mauve' : 'font-normal text-sub'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-[13px_15px]">
        {active === 'why' && decision.why && (
          <p className="m-0 text-[13.5px] leading-[1.75] text-text">{decision.why}</p>
        )}
        {active === 'cmp' && decision.cmp && <CmpTable cmp={decision.cmp} />}
        {active === 'dia' && decision.dia && (
          <p className="m-0 font-mono text-[12.5px] text-sub">[diagram: {decision.dia}]</p>
        )}
      </div>
    </div>
  )
}

/** Compact comparison table (Reader.dc.html's cmpTable): head cells mauve
 * semibold, first column of each body row rendered as a semibold `<th>`,
 * every other cell a `<td>`; header underline uses `line`, body row
 * separators use `line2`. Unlike the prototype's `cols` mock (which
 * excluded the row-label column), this schema's `head` already includes
 * every column header -- including the label column -- so it is mapped
 * directly with no synthetic leading blank cell, matching how DataTable
 * renders the real `table` block. */
function CmpTable({ cmp }: { cmp: CmpTableData }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>
            {cmp.head.map((cell, i) => (
              <th
                key={i}
                className="border-b border-line px-2.5 py-[7px] text-left font-semibold text-mauve"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cmp.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) =>
                ci === 0 ? (
                  <th
                    key={ci}
                    scope="row"
                    className="border-b border-line2 px-2.5 py-[7px] text-left font-semibold text-text"
                  >
                    {cell}
                  </th>
                ) : (
                  <td key={ci} className="border-b border-line2 px-2.5 py-[7px] text-left text-sub">
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
