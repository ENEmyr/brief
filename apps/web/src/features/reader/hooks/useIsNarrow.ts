'use client'
import { useSyncExternalStore } from 'react'

/** The reader's one layout breakpoint: under 880 the outline and dock collapse. */
export const NARROW_BELOW_PX = 880

// The exact complement of `min-[880px]:` (Tailwind's `max-[880px]:` compiles to
// `not all and (min-width: 880px)`). Browser zoom gives fractional widths such
// as 879.5, which a `max-width: 879px` query misses while the CSS calls them narrow.
const NARROW = `(width < ${NARROW_BELOW_PX}px)`

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(NARROW)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export function useIsNarrow(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(NARROW).matches,
    () => false,
  )
}
