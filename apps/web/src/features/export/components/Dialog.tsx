'use client'
import { useId, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useDialogFocus } from '../hooks/useDialogFocus'

/** features.md stacking order. */
const LAYER = { dialog: 'z-[95]', fallback: 'z-[120]' } as const

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line'

/** B-Overlays buttons inside a dialog. */
const BUTTON = `min-h-9 cursor-pointer rounded-ctrl text-[13px] transition-transform duration-[var(--dur-fast)] active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 motion-reduce:transition-none max-[880px]:min-h-11 ${FOCUS_RING}`
/** Add the padding at the call site: the boards give 14 or 16. */
export const PRIMARY_BUTTON = `${BUTTON} border-0 bg-accent font-semibold text-on-accent`
export const SECONDARY_BUTTON = `${BUTTON} border border-line2 bg-transparent px-[14px] text-text`

export const KBD = 'rounded-[3px] border border-line2 px-[5px] py-px font-mono text-[11px]'

/**
 * The dialog shell (B-Overlays SHELL). Behavior per interactions.md:
 * labelled by its title, focus moves to `initialFocusRef` and returns to the
 * trigger, Tab stays inside, body scroll locks, and Escape or a scrim click
 * closes it unless `busy`.
 */
export function Dialog({
  title,
  icon,
  layer = 'dialog',
  busy = false,
  initialFocusRef,
  onClose,
  onKeyDown,
  children,
}: {
  title: string
  icon?: ReactNode
  layer?: keyof typeof LAYER
  busy?: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
  onClose: () => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const dismiss = () => {
    if (!busy) onClose()
  }
  useDialogFocus(panelRef, dismiss, initialFocusRef)

  return (
    <div
      className={`console-fade fixed inset-0 ${LAYER[layer]} flex items-start justify-center overflow-y-auto bg-[var(--c-scrim)] px-4 pb-4 pt-16 print:hidden sheet:items-end sheet:p-0`}
      onClick={dismiss}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
        className="console-dialog flex w-[442px] max-w-full flex-col rounded-overlay border border-line2 bg-card leading-[normal] text-text shadow-[var(--shadow-overlay)] outline-none sheet:max-h-[calc(100dvh-64px)] sheet:w-full sheet:overflow-y-auto sheet:rounded-b-none sheet:rounded-t-[10px] sheet:border-x-0 sheet:border-b-0"
      >
        <span aria-hidden="true" className="mt-2 hidden h-1 w-9 shrink-0 self-center rounded-[2px] bg-line2 sheet:block" />
        <div className="flex items-center gap-[10px] border-b border-line py-[10px] pl-[18px] pr-[10px]">
          {icon}
          <span id={titleId} className="grow text-[15px] font-semibold">
            {title}
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={`flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-ctrl border-0 bg-transparent text-sub transition-transform duration-[var(--dur-fast)] active:scale-[.97] motion-reduce:transition-none max-[880px]:size-11 ${FOCUS_RING}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** A dialog's buttons, right-aligned with the primary last; stacked full width at 44 in the bottom sheet. */
export function DialogActions({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`flex justify-end gap-2 sheet:flex-col sheet:items-stretch sheet:[&>button]:min-h-11 ${className}`}>
      {children}
    </div>
  )
}

/** A 16px accent glyph for the title row (the B-Overlays link, archive and lock icons). */
export function DialogIcon({ children }: { children: ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-accent-line">
      {children}
    </svg>
  )
}
