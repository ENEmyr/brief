'use client'
import { useSyncExternalStore } from 'react'

/** The reader's one layout breakpoint: under 880 the outline and dock collapse. */
const NARROW = '(max-width: 879px)'

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
