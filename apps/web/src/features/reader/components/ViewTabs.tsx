'use client'
import { useRef } from 'react'
import { VIEW_TABS } from '../lib/views'
import type { ReaderView } from '../lib/views'
import { FOCUS_RING } from './topbarChrome'

/** B-Reader's view switch: Document, Diagrams, Raw (owner ruling D2: no Decisions tab). */
export function ViewTabs({
  view,
  onChange,
  disabled,
  className = '',
}: {
  view: ReaderView
  onChange: (view: ReaderView) => void
  disabled?: ReadonlySet<ReaderView>
  className?: string
}) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const enabled = VIEW_TABS.filter((t) => !disabled?.has(t.id))

  // Left/Right move between tabs and select (ARIA APG tabs, automatic activation).
  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const at = enabled.findIndex((t) => t.id === view)
    const step = event.key === 'ArrowRight' ? 1 : -1
    const next = enabled[(at + step + enabled.length) % enabled.length]
    if (!next) return
    onChange(next.id)
    tabRefs.current[VIEW_TABS.indexOf(next)]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label="View"
      onKeyDown={handleKeyDown}
      className={`flex shrink-0 gap-[2px] rounded-[6px] border border-line bg-card p-[2px] ${className}`}
    >
      {VIEW_TABS.map((tab, i) => {
        const selected = tab.id === view
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[i] = el
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled?.has(tab.id)}
            onClick={() => onChange(tab.id)}
            className={`min-h-[30px] rounded-[4px] border-0 px-[10px] text-[13px] transition-[background-color,transform] duration-[var(--dur-fast)] active:scale-[.97] disabled:opacity-45 motion-reduce:transition-none ${
              selected ? 'bg-chip text-text' : 'bg-transparent text-faint hover:bg-chip'
            } ${FOCUS_RING}`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
