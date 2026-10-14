'use client'
import { Fragment, useCallback, useEffect, useId, useRef } from 'react'
import type { JSX } from 'react'
import { useDialogFocus } from '@/features/export'
import { SHORTCUT_ROWS, modKeyLabel } from '../lib/registry'

/**
 * The `?` sheet: every registry row with its keys as kbd chips (B-Foundations
 * keyboard panel) inside the B-Overlays dialog shell.
 */
export function ShortcutSheet({ onClose }: { onClose: () => void }): JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // useDialogFocus re-runs on every new onClose identity, which would bounce
  // focus to the trigger and back each time the shell re-renders.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  const stableClose = useCallback(() => onCloseRef.current(), [])
  useDialogFocus(panelRef, stableClose)

  const mod = modKeyLabel()

  return (
    <div className="console-fade fixed inset-0 z-[95] flex items-start justify-center bg-[var(--c-scrim)] px-4 pt-16" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="console-pop w-[440px] max-w-full rounded-overlay border border-line2 bg-card shadow-[var(--shadow-overlay)] outline-none"
      >
        <div className="flex items-center gap-2.5 border-b border-line py-2.5 pl-[18px] pr-2.5">
          <span id={titleId} className="grow text-[15px] font-semibold">
            Keyboard shortcuts
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 cursor-pointer items-center justify-center rounded-ctrl text-sub hover:bg-chip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line max-[880px]:min-h-11 max-[880px]:min-w-11"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 p-[18px] text-[13px] text-sub">
          {SHORTCUT_ROWS.map((row) => (
            <Fragment key={row.description}>
              <span className="flex gap-1">
                {row.keys.map((key) => (
                  <kbd
                    key={key}
                    className="rounded-ctrl border border-b-2 border-line2 px-1.5 py-0.5 font-mono text-[11px] text-text"
                  >
                    {key === 'mod' ? mod : key}
                  </kbd>
                ))}
              </span>
              <span>{row.description}</span>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
