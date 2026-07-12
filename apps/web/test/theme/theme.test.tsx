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
    document.documentElement.setAttribute('data-theme', 'latte')
  })

  afterEach(() => {
    // These two are module-level singletons (see useTheme.ts) -- reset so a
    // test that begins a themed render or sets the print override can never
    // leak into the next test in this file.
    act(() => setThemePrintOverride(null))
  })

  it('toggles latte to mocha and persists', () => {
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button', { name: /toggle theme/i }))
    expect(document.documentElement.dataset.theme).toBe('mocha')
    expect(localStorage.getItem('idocs:theme')).toBe('mocha')
  })

  describe('setThemePrintOverride', () => {
    it('forces every useTheme() subscriber to the override, regardless of data-theme, until cleared', () => {
      document.documentElement.setAttribute('data-theme', 'mocha')
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe('mocha')

      act(() => setThemePrintOverride('latte'))
      expect(result.current.theme).toBe('latte')

      act(() => setThemePrintOverride(null))
      expect(result.current.theme).toBe('mocha')
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
