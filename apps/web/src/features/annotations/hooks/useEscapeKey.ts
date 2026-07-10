'use client'
import { useEffect } from 'react'

/** Calls onEscape whenever the Escape key is pressed anywhere in the
 * document, for as long as the caller stays mounted. Shared by NotePopover
 * and AskPopover, which are both non-modal (no focus trap, matching the
 * prototype) and rely on Escape + their own "Done" button to close. */
export function useEscapeKey(onEscape: () => void): void {
  useEffect(() => {
    function handleKeyDown(ev: KeyboardEvent) {
      if (ev.key === 'Escape') onEscape()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onEscape])
}
