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

    const idsList = key.split(',')
    let rafId: number | null = null
    let observer: IntersectionObserver | null = null

    function queryElements(): HTMLElement[] {
      return idsList
        .map((id) => document.querySelector<HTMLElement>(`[data-section="${id}"]`))
        .filter((el): el is HTMLElement => el !== null)
    }

    function setup(elements: HTMLElement[]) {
      if (elements.length === 0) return

      const entryById = new Map<Element, IntersectionObserverEntry>()

      observer = new IntersectionObserver(
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

          // If nothing is currently intersecting (e.g. a scroll gap between
          // sections, or scrolling past the last one), keep the previously
          // active id rather than clearing it — a sticky "last active"
          // highlight reads better than the indicator disappearing mid-scroll.
          if (topMost) {
            const id = (topMost.target as HTMLElement).dataset.section
            if (id) setActiveId(id)
          }
        },
        { rootMargin: '-20% 0px -70% 0px' },
      )

      elements.forEach((el) => observer?.observe(el))
    }

    const elements = queryElements()

    // This hook assumes SessionView mounts all [data-section] nodes in the
    // same commit that mounts the Toc (and thus this hook). Normally that
    // means every id resolves on the very first run. If it doesn't — a
    // slower child render path, or a future caller that doesn't uphold that
    // assumption — retry once on the next animation frame before giving up,
    // instead of silently never activating the observer for the run's
    // lifetime.
    if (elements.length < idsList.length) {
      rafId = requestAnimationFrame(() => {
        setup(queryElements())
      })
    } else {
      setup(elements)
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      observer?.disconnect()
    }
  }, [key])

  return activeId
}
