'use client'
import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'latte' | 'mocha'
const listeners = new Set<() => void>()

function current(): Theme {
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
