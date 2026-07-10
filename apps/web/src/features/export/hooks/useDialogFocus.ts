import { useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * Shared dialog focus-trap/-restore behavior for ShareModal and
 * CopyFallbackModal (both true `role="dialog" aria-modal` overlays, prototype
 * shareModal/copyModalView) -- extracted since both need the identical
 * remember-focus / move-focus-in / contain-Tab / close-on-Escape /
 * restore-focus-on-close sequence, matching the same pattern already used
 * (inline, not shared) by Toc.tsx's mobile drawer. `initialFocusRef` lets a
 * caller focus a specific element (CopyFallbackModal's textarea, so it's
 * also pre-selected) instead of the panel root itself.
 */
export function useDialogFocus(
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocusRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const initial = initialFocusRef?.current ?? panelRef.current
    initial?.focus()
    if (initial instanceof HTMLTextAreaElement) initial.select()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (!first || !last) return

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [onClose, panelRef, initialFocusRef])
}
