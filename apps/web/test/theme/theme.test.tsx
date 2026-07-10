import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeToggle } from '@/features/theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.setAttribute('data-theme', 'latte')
  })

  it('toggles latte to mocha and persists', () => {
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button', { name: /toggle theme/i }))
    expect(document.documentElement.dataset.theme).toBe('mocha')
    expect(localStorage.getItem('idocs:theme')).toBe('mocha')
  })
})
