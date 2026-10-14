'use client'
import { useEffect, useRef, useState } from 'react'

function computePct(): number {
  const { scrollTop, scrollHeight, clientHeight } = document.documentElement
  const denom = scrollHeight - clientHeight
  // NaN-safe: content that fits in the viewport has no progress to show.
  if (denom <= 0) return 0
  return Math.round(Math.max(0, Math.min(100, (scrollTop / denom) * 100)))
}

/** B-Reader's 2px reading progress line: `elev` track, `accent` fill. */
export function ProgressBar() {
  const [pct, setPct] = useState(0)
  const scheduled = useRef(false)
  const rafId = useRef(0)

  useEffect(() => {
    setPct(computePct())

    // One update per frame however many scroll events arrive.
    function handleScroll() {
      if (scheduled.current) return
      scheduled.current = true
      rafId.current = requestAnimationFrame(() => {
        scheduled.current = false
        setPct(computePct())
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [])

  return (
    <div
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-[2px] bg-elev print:hidden"
    >
      <div className="h-[2px] bg-accent" style={{ width: `${pct}%` }} />
    </div>
  )
}
