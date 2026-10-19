'use client'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Keeps an overlay mounted through its exit (interactions.md:40, B-Overlays:186:
 * opacity only, at the fast duration). Pass the overlay as `children` only
 * while `open`. On close the last children stay, inert, while the
 * `[data-overlay-exit]` rule in globals.css fades them out; they unmount when
 * that animation ends. A reopen during the exit mounts a fresh overlay, so its
 * focus handling runs again.
 */
export function OverlayExit({ open, children }: { open: boolean; children: ReactNode }) {
  const last = useRef<ReactNode>(null)
  const [wasOpen, setWasOpen] = useState(open)
  const [closing, setClosing] = useState(false)
  const [generation, setGeneration] = useState(0)
  if (open !== wasOpen) {
    setWasOpen(open)
    setClosing(!open)
    if (open) setGeneration((g) => g + 1)
  }
  if (open) last.current = children

  useEffect(() => {
    if (!closing) return
    // Fallback for an animationend that never comes (a hidden tab, a missing rule): twice the token.
    const fast = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dur-fast')) || 0
    const timer = setTimeout(() => setClosing(false), fast * 2)
    return () => clearTimeout(timer)
  }, [closing])

  return (
    <div
      key={generation}
      className="contents"
      data-overlay-exit={closing ? '' : undefined}
      inert={closing}
      onAnimationEnd={(event) => {
        if (closing && event.animationName === 'console-out' && event.target === event.currentTarget.firstElementChild)
          setClosing(false)
      }}
    >
      {open ? children : closing ? last.current : null}
    </div>
  )
}
