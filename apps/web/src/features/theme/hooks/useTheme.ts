'use client'
import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'latte' | 'mocha'
const listeners = new Set<() => void>()

/**
 * Print-time palette override (bug: printing from mocha left mermaid/echarts
 * unreadable). `useTheme()` is the single read path every JS-themed renderer
 * (echarts.ts's useEChart, MermaidBlock) goes through, so forcing the value
 * this returns -- rather than the `data-theme` DOM attribute the CSS cascade
 * reads -- reaches both without touching either renderer directly. This is
 * intentionally NOT persisted and does not touch `data-theme`: it is a
 * transient in-memory override for the duration of one print, not a theme
 * change the user asked for. See lib/print.ts for the begin/end sequencing.
 */
let printOverride: Theme | null = null

function current(): Theme {
  if (printOverride) return printOverride
  if (typeof document === 'undefined') return 'latte'
  return document.documentElement.dataset.theme === 'mocha' ? 'mocha' : 'latte'
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    current,
    () => 'latte' as Theme,
  )
  const toggle = useCallback(() => {
    const next: Theme = current() === 'latte' ? 'mocha' : 'latte'
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('idocs:theme', next)
    } catch {
      // private mode: theme just does not persist
    }
    listeners.forEach((l) => l())
  }, [])
  return { theme, toggle }
}

/**
 * Sets or clears the print-time palette override and notifies every
 * `useTheme()` subscriber, so every echarts chart and MermaidBlock currently
 * mounted re-renders with `theme` reading as `override` (or, passed `null`,
 * back to whatever `data-theme` actually says). Exported for lib/print.ts;
 * not meant for any other caller.
 */
export function setThemePrintOverride(override: Theme | null): void {
  printOverride = override
  listeners.forEach((l) => l())
}

// Count of chart/diagram renders in flight for the CURRENT theme value ---
// incremented when a themed render starts, decremented when it settles
// (success or failure). lib/print.ts polls this via whenThemedRendersIdle so
// it can wait for mermaid/echarts to actually finish redrawing in the forced
// print palette before handing off to window.print(), instead of guessing a
// fixed delay.
let pendingRenders = 0
let idleWaiters: Array<() => void> = []

/**
 * Call when a themed render (echarts setOption, mermaid.render) starts;
 * call the returned function when it settles, in a `.finally()` so a
 * rejected render still counts as done. Every `useEChart` chart and
 * MermaidBlock wraps its render effect with this pair.
 */
export function beginThemedRender(): () => void {
  pendingRenders += 1
  let settled = false
  return () => {
    if (settled) return
    settled = true
    pendingRenders = Math.max(0, pendingRenders - 1)
    if (pendingRenders === 0) {
      const waiters = idleWaiters
      idleWaiters = []
      waiters.forEach((resolve) => resolve())
    }
  }
}

/** Resolves once no themed render is in flight, for tests / direct callers
 *  that do not need print's grace period or timeout ceiling. */
export function whenThemedRendersIdle(): Promise<void> {
  if (pendingRenders === 0) return Promise.resolve()
  return new Promise((resolve) => idleWaiters.push(resolve))
}
