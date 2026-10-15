'use client'
import { useEffect } from 'react'
import { findSection } from '../lib/sectionNav'

/** Where a context chip took the reader from (D7): a decision, and the section it jumped to. */
export interface BackTarget {
  decisionId: string
  sectionId: string
}

/**
 * "Back to D2" after a context chip jump (D7). No board draws it, so it is the
 * toast's box (components.md "Toast"): chip fill, line2 border, toast shadow,
 * 24 above the viewport's bottom edge, and under 880 24 above the dock's peek
 * bar (97 high, B-Mobile). It leaves on Escape, and once the section it jumped
 * to has been on screen and is scrolled out of view.
 */
export function BackPill({
  target,
  onBack,
  onDismiss,
}: {
  target: BackTarget
  onBack: () => void
  onDismiss: () => void
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onDismiss])

  useEffect(() => {
    const section = findSection(target.sectionId)
    if (!section) return
    // A smooth scroll starts with the section off screen: only leaving it after arriving counts.
    let arrived = false
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) arrived = true
      else if (arrived) onDismiss()
    })
    observer.observe(section)
    return () => observer.disconnect()
  }, [target.sectionId, onDismiss])

  return (
    <button
      type="button"
      data-back-pill=""
      onClick={onBack}
      className="console-toast fixed inset-x-0 bottom-6 z-[110] mx-auto flex min-h-[42px] w-fit cursor-pointer items-center gap-2 rounded-panel border border-line2 bg-chip px-[14px] text-[13px] font-semibold leading-[normal] text-text shadow-[var(--shadow-toast)] transition-transform duration-[var(--dur-fast)] active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line motion-reduce:transition-none max-[880px]:bottom-[121px] max-[880px]:min-h-11 print:hidden"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0 text-accent-text"
      >
        <path d="M19 12H5M11 6l-6 6 6 6" />
      </svg>
      Back to {target.decisionId}
    </button>
  )
}
