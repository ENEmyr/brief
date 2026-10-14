import { useEffect, useRef, useState } from 'react'

/** features.md B2: a stat counts up once, over 600ms, the first time it is on screen. */
const COUNT_UP_MS = 600

/** A stat value that is one number with an optional sign or currency before it and a unit after it. */
export interface StatNumber {
  prefix: string
  value: number
  decimals: number
  grouped: boolean
  suffix: string
}

const STAT_NUMBER = /^([+\-−]?[$€£¥]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(\D*)$/

/**
 * Null for anything that is not a single number ("±5%", "5–30 ms", "exact",
 * "<1 ms", "Q3"): those show their final text at once, since counting up a
 * range or a bound would show a value the agent never wrote.
 */
export function parseStatNumber(text: string): StatNumber | null {
  const match = STAT_NUMBER.exec(text)
  if (!match) return null
  const [, prefix = '', whole = '', fraction, suffix = ''] = match
  const value = Number(`${whole.replaceAll(',', '')}.${fraction ?? '0'}`)
  if (value === 0) return null
  return { prefix, value, decimals: fraction?.length ?? 0, grouped: whole.includes(','), suffix }
}

/** The number at `progress` (0 to 1) of the way up, written the way the value itself is written. */
export function formatStatNumber(n: StatNumber, progress: number): string {
  const digits = (n.value * progress).toFixed(n.decimals)
  const [whole = '', fraction] = digits.split('.')
  const grouped = n.grouped ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : whole
  return `${n.prefix}${grouped}${fraction === undefined ? '' : `.${fraction}`}${n.suffix}`
}

/** tokens.css --ease-console, cubic-bezier(0.3, 0.8, 0.3, 1), as a function of time. */
export function easeConsole(t: number): number {
  const bezier = (a: number, b: number, s: number) =>
    3 * a * s * (1 - s) ** 2 + 3 * b * s ** 2 * (1 - s) + s ** 3
  let lo = 0
  let hi = 1
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (bezier(0.3, 0.3, mid) < t) lo = mid
    else hi = mid
  }
  return bezier(0.8, 1, (lo + hi) / 2)
}

export type CountPhase = 'waiting' | 'counting' | 'done'

// Keyed on the payload's block object, which lives as long as the loaded
// session, so a stat that unmounts and comes back (the Diagrams view, a
// collapsed details) never counts a second time.
const counted = new WeakSet<object>()

function initialPhase(block: object, countable: boolean): CountPhase {
  if (
    !countable ||
    counted.has(block) ||
    typeof window === 'undefined' ||
    typeof IntersectionObserver === 'undefined'
  )
    return 'done'
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'done' : 'waiting'
}

/**
 * A block with no countable value never counts. Otherwise this waits until
 * the element is first on screen, then runs `progress` from 0 to
 * 1 over COUNT_UP_MS on the --ease-console curve. Elapsed time comes from the
 * animation frame timestamps, not Date: the visual suite freezes Date.
 */
export function useCountUp(block: object, countable: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<CountPhase>(() => initialPhase(block, countable))
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (initialPhase(block, countable) !== 'waiting' || el === null) return
    let frame = 0
    let start: number | undefined
    const tick = (now: number) => {
      start ??= now
      const t = Math.min(1, (now - start) / COUNT_UP_MS)
      setProgress(easeConsole(t))
      if (t < 1) frame = requestAnimationFrame(tick)
      else setPhase('done')
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      counted.add(block)
      setPhase('counting')
      frame = requestAnimationFrame(tick)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [block, countable])

  return { ref, phase, progress }
}
