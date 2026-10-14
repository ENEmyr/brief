'use client'
import type { ReactNode } from 'react'

/**
 * What a toast says (B-States "Save status and toasts"). `done` and `archived`
 * confirm an action, `info` explains why nothing happened, `error` reports a
 * failure. An error with an action stays until it is dismissed or the action
 * runs; every other toast leaves after 1.6s. One toast shows at a time.
 */
export type ToastKind = 'done' | 'archived' | 'info' | 'error'

export interface ToastSpec {
  kind: ToastKind
  message: string
  action?: { label: string; run: () => void }
}

export interface ShownToast {
  id: number
  spec: ToastSpec
}

export const isSticky = (spec: ToastSpec): boolean => spec.kind === 'error' && spec.action !== undefined

const ICON_SIZE = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'aria-hidden': true } as const

const DOT = 'h-2 w-2 shrink-0 rounded-full'

const LEAD: Record<ToastKind, ReactNode> = {
  done: (
    <svg {...ICON_SIZE} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-good">
      <path d="M5 12l5 5 9-10" />
    </svg>
  ),
  archived: (
    <svg {...ICON_SIZE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-accent-line">
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
    </svg>
  ),
  info: <span aria-hidden="true" className={`${DOT} bg-info`} />,
  error: <span aria-hidden="true" className={`${DOT} bg-bad`} />,
}

const TEXT_BUTTON =
  'min-h-8 shrink-0 cursor-pointer rounded-ctrl border-0 bg-transparent px-[10px] text-[13px] font-semibold text-accent-text transition-transform duration-[var(--dur-fast)] active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line motion-reduce:transition-none max-[880px]:min-h-11'

export function Toast({ toast, onDismiss }: { toast: ShownToast | null; onDismiss: () => void }) {
  if (!toast) return null
  const { kind, message, action } = toast.spec
  const error = kind === 'error'
  const sticky = isSticky(toast.spec)
  return (
    <div
      key={toast.id}
      role={error ? 'alert' : 'status'}
      data-toast=""
      className={`console-toast fixed inset-x-0 bottom-6 z-[110] mx-auto flex w-fit max-w-[calc(100%-32px)] items-center gap-[10px] rounded-panel border bg-chip text-[13px] leading-[normal] text-text shadow-[var(--shadow-toast)] min-h-[42px] print:hidden ${
        `${error ? 'border-bad-line' : 'border-line2'} ${action ? 'pl-[14px] pr-[6px]' : 'px-[14px]'}`
      }`}
    >
      {LEAD[kind]}
      <span>{message}</span>
      {action && (
        <button
          type="button"
          onClick={() => {
            onDismiss()
            action.run()
          }}
          className={TEXT_BUTTON}
        >
          {action.label}
        </button>
      )}
      {sticky && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-ctrl border-0 bg-transparent text-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line max-[880px]:size-11"
        >
          <svg {...ICON_SIZE} strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  )
}
