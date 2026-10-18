'use client'
import { useSyncExternalStore } from 'react'

/** The reader's one layout breakpoint: under 880 the outline and dock collapse. */
export const NARROW_BELOW_PX = 880

// The same query Tailwind's `max-[880px]:` compiles to, so JS and CSS agree at
// every zoom. Browser zoom gives fractional widths such as 879.5, which a
// `max-width: 879px` query misses, and at dsf 1.1 an 880 window matches both
// `width < 880px` and `min-width: 880px`.
const NARROW = `not all and (min-width: ${NARROW_BELOW_PX}px)`

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
