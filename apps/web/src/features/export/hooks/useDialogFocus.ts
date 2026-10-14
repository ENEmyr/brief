import { useEffect, useId, useRef } from 'react'
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
let lockCount = 0
let stylesBeforeLock = { overflow: '', gutter: '' }

function lockScroll() {
  const root = document.documentElement
  stylesBeforeLock = { overflow: document.body.style.overflow, gutter: root.style.getPropertyValue('scrollbar-gutter') }
  // A classic scrollbar leaves its gutter behind, so the page does not shift sideways when it goes.
  if (window.innerWidth > root.clientWidth) root.style.setProperty('scrollbar-gutter', 'stable')
  document.body.style.overflow = 'hidden'
}

function unlockScroll() {
  document.body.style.overflow = stylesBeforeLock.overflow
  document.documentElement.style.setProperty('scrollbar-gutter', stylesBeforeLock.gutter)
}

/** Safari before 17.4 has no checkVisibility; an element with no layout box has no client rects either. */
const isRendered = (el: HTMLElement): boolean =>
  typeof el.checkVisibility === 'function' ? el.checkVisibility() : el.getClientRects().length > 0

/** A roving-tabindex radio that is not checked has tabIndex -1. */
const isTabStop = (el: HTMLElement): boolean => el.tabIndex >= 0 && !el.matches(':disabled') && isRendered(el)

/**
 * Shared modal behavior for every dialog and sheet (interactions.md): move
 * focus in, contain Tab, close the topmost one on Escape, lock body scroll
 * while a modal is open, and restore focus on close. The Tab loop also reaches
 * a toast's buttons, so the Retry on an error toast raised over a dialog is
 * not out of reach. `initialFocusRef` names the element that takes
 * focus (the first field, or the primary action); without it the panel root
 * does. A textarea that takes focus is also selected. `onClose` is read when
 * Escape is pressed, so a caller may pass a new function on every render.
 */
export function useDialogFocus(
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocusRef?: RefObject<HTMLElement | null>,
) {
  const dialogId = useId()
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const modal = panelRef.current?.getAttribute('aria-modal') === 'true'
    if (modal && lockCount++ === 0) lockScroll()
    dialogStack.push(dialogId)
    const previouslyFocused = document.activeElement as HTMLElement | null
    const initial = initialFocusRef?.current ?? panelRef.current
    initial?.focus()
    if (initial instanceof HTMLTextAreaElement) initial.select()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (dialogStack[dialogStack.length - 1] === dialogId) onCloseRef.current()
        return
      }

      if (event.key === 'Tab' && panelRef.current && dialogStack[dialogStack.length - 1] === dialogId) {
        const selector = 'button, [href], input, select, textarea, [tabindex]'
        const focusable = [
          ...panelRef.current.querySelectorAll<HTMLElement>(selector),
          ...document.querySelectorAll<HTMLElement>(`[data-toast] :is(${selector})`),
        ].filter(isTabStop)
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (!first || !last) return

        const at = focusable.indexOf(document.activeElement as HTMLElement)
        if (event.shiftKey && at <= 0) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && (at === -1 || at === focusable.length - 1)) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      const at = dialogStack.indexOf(dialogId)
      if (at !== -1) dialogStack.splice(at, 1)
      if (modal && --lockCount === 0) unlockScroll()
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [panelRef, initialFocusRef, dialogId])
}
