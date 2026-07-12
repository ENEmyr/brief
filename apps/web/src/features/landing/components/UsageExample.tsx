'use client'
import { useState } from 'react'
import { CodePanel } from './CodePanel'
import { CURL_SNIPPET, SKILL_SNIPPET } from '../lib/content'
import { FOCUS_RING } from '../lib/styles'

const TABS = [
  {
    id: 'skill',
    label: 'With the skill',
    code: SKILL_SNIPPET,
    blurb:
      'The skill teaches the agent the schema, ships an offline validator, and travels with the repository. This is the path most agents want.',
  },
  {
    id: 'http',
    label: 'Straight HTTP',
    code: CURL_SNIPPET,
    blurb:
      'No skill, no SDK, no auth. Any agent that can make an HTTP request can publish a document and read it back.',
  },
] as const

export function UsageExample() {
  const [active, setActive] = useState<(typeof TABS)[number]['id']>('skill')
  const tab = TABS.find((candidate) => candidate.id === active) ?? TABS[0]

  return (
    <section className="border-t border-line bg-elev">
      <div className="mx-auto max-w-[1080px] px-6 py-16">
        <h2 className="text-[24px] font-semibold tracking-tight text-text">Wire it up</h2>
        <p className="mt-2 max-w-[62ch] text-[15px] text-sub">
          Two ways in. Both end with the same link, and neither needs an API key.
        </p>

        <div className="mt-8 grid gap-6 min-[880px]:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] min-[880px]:gap-10">
          <div>
            <div role="tablist" aria-label="Integration path" className="flex flex-col gap-1">
              {TABS.map((candidate) => {
                const selected = candidate.id === active
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    role="tab"
                    id={`tab-${candidate.id}`}
                    aria-selected={selected}
                    aria-controls={`panel-${candidate.id}`}
                    onClick={() => setActive(candidate.id)}
                    className={`flex min-h-11 items-center rounded-lg border px-4 text-left text-[14px] transition-colors ${FOCUS_RING} ${
                      selected
                        ? 'border-mauve bg-mauvesoft font-medium text-mauve'
                        : 'border-line bg-card text-sub hover:border-mauve'
                    }`}
                  >
                    {candidate.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-4 text-[13.5px] leading-relaxed text-sub">{tab.blurb}</p>
          </div>

          <div
            role="tabpanel"
            id={`panel-${tab.id}`}
            aria-labelledby={`tab-${tab.id}`}
            className="min-w-0"
          >
            <CodePanel caption="terminal" code={tab.code} language="shell" />
          </div>
        </div>
      </div>
    </section>
  )
}
