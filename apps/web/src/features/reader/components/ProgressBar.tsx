'use client'
import { useEffect, useRef, useState } from 'react'

export function ProgressBar() {
  const [pct, setPct] = useState(0)
  const scheduled = useRef(false)
  const rafId = useRef(0)

  // Compute scroll progress percentage
  function computePct(): number {
    const scrollTop = document.documentElement.scrollTop
    const scrollHeight = document.documentElement.scrollHeight
    const clientHeight = document.documentElement.clientHeight
    const denom = scrollHeight - clientHeight

    // NaN-safe: if content fits in viewport, return 0
    if (denom <= 0) return 0

    const raw = (scrollTop / denom) * 100
    // Clamp to 0-100 and round to integer
    return Math.round(Math.max(0, Math.min(100, raw)))
  }

  // Called by rAF to update state
  function tick() {
    scheduled.current = false
    setPct(computePct())
  }

  // Scroll event handler: throttle with rAF using scheduled flag
  function handleScroll() {
    if (scheduled.current) return
    scheduled.current = true
    rafId.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    // Initial compute synchronously (not via rAF)
    setPct(computePct())

    // Add passive scroll listener
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
      className="fixed left-0 top-0 z-20 w-full bg-mauve print:hidden"
      style={{ height: '3px', width: `${pct}%` }}
    />
  )
}
