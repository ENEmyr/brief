import { useEffect, useId } from 'react'
import type { RefObject } from 'react'

/**
 * Module-level stack of currently-open dialog ids, newest last. Escape must
 * only close the TOPMOST dialog: with CopyFallbackModal stacked over
 * ShareModal, both hooks receive the same document keydown, and without the
 * stack check a single Escape would close both at once (review finding on
 * this task). Each useDialogFocus instance registers its id on mount and
 * removes it on close/unmount, so "am I on top?" is just a last-element
 * comparison.
 */
const dialogStack: string[] = []

/**
 * Shared dialog focus-trap/-restore behavior for ShareModal and
 * CopyFallbackModal (both true `role="dialog" aria-modal` overlays, prototype
 * shareModal/copyModalView) -- extracted since both need the identical
 * remember-focus / move-focus-in / contain-Tab / close-on-Escape /
 * restore-focus-on-close sequence, matching the same pattern already used
 * (inline, not shared) by Toc.tsx's mobile drawer. `initialFocusRef` lets a
 * caller focus a specific element (CopyFallbackModal's textarea, so it's
 * also pre-selected) instead of the panel root itself. Escape only closes
 * this dialog when it is the topmost open dialog (see dialogStack above).
 */
export function useDialogFocus(
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocusRef?: RefObject<HTMLElement | null>,
) {
  const dialogId = useId()

  useEffect(() => {
    dialogStack.push(dialogId)
    const previouslyFocused = document.activeElement as HTMLElement | null
    const initial = initialFocusRef?.current ?? panelRef.current
    initial?.focus()
    if (initial instanceof HTMLTextAreaElement) initial.select()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (dialogStack[dialogStack.length - 1] === dialogId) onClose()
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
      const at = dialogStack.indexOf(dialogId)
      if (at !== -1) dialogStack.splice(at, 1)
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [onClose, panelRef, initialFocusRef, dialogId])
}
