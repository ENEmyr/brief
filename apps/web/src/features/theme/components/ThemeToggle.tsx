'use client'
import { useTheme } from '../hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={toggle}
      className="group flex min-h-11 min-w-11 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line"
    >
      <span
        className={`relative h-[28px] w-[52px] rounded-full border border-line transition-colors group-hover:border-accent-line ${isDark ? 'bg-elev' : 'bg-chip'}`}
      >
        <span
          className="absolute top-[2px] flex h-[22px] w-[22px] items-center justify-center rounded-full text-[12px] transition-[left] duration-200"
          style={{
            left: isDark ? '26px' : '2px',
            background: isDark ? 'var(--c-accent)' : 'var(--c-card)',
            color: isDark ? 'var(--c-on-accent)' : 'var(--c-text)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {isDark ? '☾' : '☀'}
        </span>
      </span>
    </button>
  )
}
