'use client'
import { useState } from 'react'
import { USAGE_TABS } from '../lib/content'
import { FOCUS_RING, H2, PAD } from '../lib/styles'
import { CopyButton } from './CopyButton'
import styles from './landing.module.css'

function Snippet({ code }: { code: string }) {
  return code.split('\n').map((line, i) => (
    <span key={i}>
      {i > 0 ? '\n' : null}
      {line.startsWith('#') ? <span className="text-faint">{line}</span> : line}
    </span>
  ))
}

export function UsageExample() {
  const [active, setActive] = useState<(typeof USAGE_TABS)[number]['id']>('skill')
  const tab = USAGE_TABS.find((candidate) => candidate.id === active) ?? USAGE_TABS[0]

  return (
    <section id="usage" className={`mx-auto flex max-w-[1280px] flex-col gap-6 py-[72px] ${PAD}`}>
      <div className="flex flex-col gap-2">
        <h2 className={H2}>Wire it up</h2>
        <p className="m-0 max-w-[640px] text-[16px] leading-[26px] text-sub">
          Two paths to the same link. Pick the one your agent can run.
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex max-w-[380px] flex-[1_1_280px] flex-col gap-3">
          <div
            role="tablist"
            aria-label="Integration path"
            aria-orientation="vertical"
            className="flex flex-col gap-[6px]"
          >
            {USAGE_TABS.map((candidate) => {
              const selected = candidate.id === active
              return (
                <button
                  key={candidate.id}
                  type="button"
                  role="tab"
                  id={`tab-${candidate.id}`}
                  aria-selected={selected}
                  aria-controls="usage-panel"
                  onClick={() => setActive(candidate.id)}
                  className={`${styles.btn} flex min-h-[52px] flex-col justify-center gap-[2px] rounded-[6px] border px-[14px] py-2 text-left text-text ${FOCUS_RING} ${
                    selected ? 'border-accent-line bg-accent-soft' : 'border-line bg-card'
                  }`}
                >
                  <span className="text-[15px] font-semibold">{candidate.label}</span>
                  <span className={`font-mono text-[11px] ${selected ? 'text-accent-text' : 'text-faint'}`}>
                    {candidate.hint}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="m-0 text-[14px] leading-[22px] text-sub">{tab.blurb}</p>
        </div>
        <div
          role="tabpanel"
          id="usage-panel"
          aria-labelledby={`tab-${tab.id}`}
          className="min-w-0 flex-[999_1_482px] overflow-hidden rounded-[8px] border border-line bg-card"
        >
          <div className="flex items-center gap-2 border-b border-line py-2 pr-2 pl-[14px] font-mono text-[11px] text-faint">
            <span className="grow">terminal</span>
            <CopyButton
              text={tab.code}
              label="Copy terminal commands"
              className="min-h-8 rounded-[4px] border border-line2 bg-transparent px-[10px]"
            />
          </div>
          <pre className="m-0 overflow-x-auto p-4 font-mono text-[13px] leading-[22px] text-text">
            <Snippet code={tab.code} />
          </pre>
        </div>
      </div>
    </section>
  )
}
