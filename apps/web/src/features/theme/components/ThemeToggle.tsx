'use client'
import { useTheme } from '../hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isMocha = theme === 'mocha'
  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={toggle}
      className="group flex min-h-11 min-w-11 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mauve"
    >
      <span
        className={`relative h-[28px] w-[52px] rounded-full border border-line transition-colors group-hover:border-mauve ${isMocha ? 'bg-elev' : 'bg-chip'}`}
      >
        <span
          className="absolute top-[2px] flex h-[22px] w-[22px] items-center justify-center rounded-full text-[12px] transition-[left] duration-200"
          style={{
            left: isMocha ? '26px' : '2px',
            background: isMocha ? 'var(--ctp-mauve)' : '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,.3)',
          }}
        >
          {isMocha ? '☾' : '☀'}
        </span>
      </span>
    </button>
  )
}
