import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { THEME_INIT_SCRIPT } from '@/features/theme'

function stubSystemScheme(dark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: dark && query === '(prefers-color-scheme: dark)' })),
  )
}

/** Runs the exact string app/layout.tsx inlines into <head>. */
function runInitScript() {
  new Function(THEME_INIT_SCRIPT)()
}

describe('theme init script', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    stubSystemScheme(false)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads a stored latte as light and writes light back', () => {
    localStorage.setItem('idocs:theme', 'latte')
    runInitScript()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('idocs:theme')).toBe('light')
  })

  it('reads a stored mocha as dark and writes dark back', () => {
    localStorage.setItem('idocs:theme', 'mocha')
    runInitScript()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('idocs:theme')).toBe('dark')
  })

  it('keeps a stored light or dark choice over the system scheme', () => {
    stubSystemScheme(true)
    localStorage.setItem('idocs:theme', 'light')
    runInitScript()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('idocs:theme')).toBe('light')
  })

  it('follows the system scheme on a first visit and stores nothing', () => {
    stubSystemScheme(true)
    runInitScript()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('idocs:theme')).toBeNull()

    stubSystemScheme(false)
    runInitScript()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('ignores an unknown stored value and follows the system scheme', () => {
    stubSystemScheme(true)
    localStorage.setItem('idocs:theme', 'solarized')
    runInitScript()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
