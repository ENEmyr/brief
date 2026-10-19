'use client'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { JSX, KeyboardEvent } from 'react'
import { useDialogFocus } from '@/features/export'
import { filterEntries, pad } from '../lib/entries'
import type { PaletteEntry } from '../lib/entries'

function EntryLead({ entry }: { entry: PaletteEntry }) {
  switch (entry.kind) {
    case 'decision':
      return <span className="min-w-[22px] shrink-0 font-mono text-[11px] text-accent-text">{entry.decisionId}</span>
    case 'block':
      return (
        <span className="shrink-0 rounded-[3px] border border-line2 px-1 font-mono text-[10px]">{entry.tag}</span>
      )
    case 'section':
      return <span className="min-w-[22px] shrink-0 font-mono text-[11px] text-faint">{pad(entry.sectionNo)}</span>
    case 'action':
      return <span aria-hidden="true" className="w-[22px] shrink-0" />
  }
}

/**
 * Command palette (B-Reader palette, B-States empty state). A combobox over a
 * grouped listbox: focus stays in the input and the active row is tracked
 * through aria-activedescendant.
 */
export function CommandPalette({
  entries,
  onSelect,
  onClose,
}: {
  entries: PaletteEntry[]
  /**
   * Called right after onClose, in the same event. The palette unmounts after
   * this returns and focus goes back to the trigger, so a handler that moves
   * focus must defer it, for example with requestAnimationFrame.
   */
  onSelect: (entry: PaletteEntry) => void
  onClose: () => void
}): JSX.Element {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const optionId = (index: number) => `${listId}-option-${index}`

  // useDialogFocus re-runs on every new onClose identity, which would bounce
  // focus to the trigger and back each time the shell re-renders.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  const stableClose = useCallback(() => onCloseRef.current(), [])
  useDialogFocus(panelRef, stableClose, inputRef)

  const groups = useMemo(() => filterEntries(entries, query), [entries, query])
  const rows = groups.flatMap((group) => group.entries)
  const hasRows = rows.length > 0
  const current = Math.min(active, rows.length - 1)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [current, query])

  function select(entry: PaletteEntry) {
    onClose()
    onSelect(entry)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const entry = rows[current]
    if (!entry || event.nativeEvent.isComposing) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive(Math.min(Math.max(current + step, 0), rows.length - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      select(entry)
    }
  }

  return (
    <div
      className="console-fade fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-[var(--c-scrim)] px-4 pb-4 pt-24"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(event) => event.stopPropagation()}
        className="console-pop flex max-h-full w-full max-w-[560px] flex-col rounded-overlay border border-line2 bg-card shadow-[var(--shadow-overlay)]"
      >
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line px-3.5">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
            className="text-faint"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            role="combobox"
            aria-label="Search the brief"
            aria-expanded={hasRows}
            aria-controls={hasRows ? listId : undefined}
            aria-activedescendant={hasRows ? optionId(current) : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            onKeyDown={handleKeyDown}
            className="min-w-0 grow text-[16px] text-text outline-none max-[880px]:min-h-11"
          />
          <kbd className="font-mono text-[11px] text-faint">esc</kbd>
        </div>
        {hasRows ? (
          <div
            id={listId}
            role="listbox"
            aria-label="Results"
            // A mousedown on a row would blur the input, and the arrow keys
            // only work while the input has focus.
            onMouseDown={(event) => event.preventDefault()}
            className="flex min-h-0 flex-col overflow-y-auto p-1.5 text-[14px]"
          >
            {groups.map((group, groupIndex) => {
              const labelId = `${listId}-${group.kind}`
              return (
                <div key={group.kind} role="group" aria-labelledby={labelId} className="flex flex-col">
                  <span
                    id={labelId}
                    className={`px-2 pb-1 font-mono text-[11px] text-faint ${groupIndex === 0 ? 'pt-2' : 'pt-2.5'}`}
                  >
                    {group.title}
                  </span>
                  {group.entries.map((entry) => {
                    const index = rows.indexOf(entry)
                    const isActive = index === current
                    return (
                      <div
                        key={entry.key}
                        id={optionId(index)}
                        ref={isActive ? activeRef : undefined}
                        role="option"
                        aria-selected={isActive}
                        // Not mouseenter: keeping the active row in view slides
                        // rows under a still pointer, which would fire it.
                        onMouseMove={() => setActive(index)}
                        onClick={() => select(entry)}
                        className={`flex min-h-[38px] cursor-pointer items-center gap-2.5 rounded-ctrl px-2 max-[880px]:min-h-11 ${
                          isActive ? 'bg-accent-soft text-text' : 'text-sub'
                        }`}
                      >
                        <EntryLead entry={entry} />
                        <span className="min-w-0 grow truncate">{entry.label}</span>
                        {entry.kind === 'block' && (
                          <span className="shrink-0 font-mono text-[11px] text-faint">§{pad(entry.sectionNo)}</span>
                        )}
                        {isActive && (
                          <kbd aria-hidden="true" className="shrink-0 font-mono text-[11px] text-sub">
                            ↵
                          </kbd>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ) : (
          query.trim() && (
            <div className="px-3 py-4 text-[13px] leading-5 text-sub">
              No match for &quot;{query}&quot;. Try a section title, a decision id like{' '}
              <span className="font-mono text-text">D2</span>, or a term.
            </div>
          )
        )}
      </div>
    </div>
  )
}
