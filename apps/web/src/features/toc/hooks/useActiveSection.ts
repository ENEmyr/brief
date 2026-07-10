'use client'
import { useEffect, useState } from 'react'

/**
 * Tracks which of the given `data-section` element ids is currently the
 * top-most intersecting section in the viewport, via IntersectionObserver.
 */
export function useActiveSection(ids: string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null)
  const key = ids.join(',')

  useEffect(() => {
    if (!key) {
      setActiveId(null)
      return
    }

    const elements = key
      .split(',')
      .map((id) => document.querySelector<HTMLElement>(`[data-section="${id}"]`))
      .filter((el): el is HTMLElement => el !== null)

    if (elements.length === 0) return

    const entryById = new Map<Element, IntersectionObserverEntry>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entryById.set(entry.target, entry)
        }

        let topMost: IntersectionObserverEntry | null = null
        for (const entry of entryById.values()) {
          if (!entry.isIntersecting) continue
          if (!topMost || entry.boundingClientRect.top < topMost.boundingClientRect.top) {
            topMost = entry
          }
        }

        if (topMost) {
          const id = (topMost.target as HTMLElement).dataset.section
          if (id) setActiveId(id)
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [key])

  return activeId
}
