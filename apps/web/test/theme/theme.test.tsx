import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import {
  ThemeToggle,
  useTheme,
  setThemePrintOverride,
  beginThemedRender,
  whenThemedRendersIdle,
} from '@/features/theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.setAttribute('data-theme', 'light')
  })

  afterEach(() => {
    // These two are module-level singletons (see useTheme.ts) -- reset so a
    // test that begins a themed render or sets the print override can never
    // leak into the next test in this file.
    act(() => setThemePrintOverride(null))
  })

  it('toggles light to dark and persists', () => {
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button', { name: /toggle theme/i }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('idocs:theme')).toBe('dark')
  })

  describe('setThemePrintOverride', () => {
    it('forces every useTheme() subscriber to the override, regardless of data-theme, until cleared', () => {
      document.documentElement.setAttribute('data-theme', 'dark')
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe('dark')

      act(() => setThemePrintOverride('light'))
      expect(result.current.theme).toBe('light')

      act(() => setThemePrintOverride(null))
      expect(result.current.theme).toBe('dark')
    })
  })

  describe('beginThemedRender / whenThemedRendersIdle', () => {
    it('resolves immediately when nothing is in flight', async () => {
      await expect(whenThemedRendersIdle()).resolves.toBeUndefined()
    })

    it('does not resolve until every in-flight render has ended', async () => {
      const endA = beginThemedRender()
      const endB = beginThemedRender()

      let resolved = false
      const idle = whenThemedRendersIdle().then(() => {
        resolved = true
      })

      endA()
      await Promise.resolve()
      expect(resolved).toBe(false)

      endB()
      await idle
      expect(resolved).toBe(true)
    })

    it('calling the returned end callback twice does not double-decrement the counter', async () => {
      const end = beginThemedRender()
      end()
      end()
      await expect(whenThemedRendersIdle()).resolves.toBeUndefined()
    })
  })
})
