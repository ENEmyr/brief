'use client'
import { useTheme } from '../hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={toggle}
      className="flex h-11 w-11 items-center justify-center rounded-lg text-subtext0 hover:bg-surface0 hover:text-text"
    >
      {theme === 'latte' ? 'Dark' : 'Light'}
    </button>
  )
}
