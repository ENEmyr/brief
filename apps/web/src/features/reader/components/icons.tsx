/** Icons drawn on B-Reader, B-Mobile and B-States, at the board's sizes and strokes. */
const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export function SearchIcon({ size }: { size: 14 | 16 | 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} strokeWidth={2} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}

export function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...STROKE} strokeWidth={1.75} aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
    </svg>
  )
}

export function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...STROKE} strokeWidth={1.75} aria-hidden="true">
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </svg>
  )
}

export function ArchiveIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      {...STROKE}
      fill={filled ? 'currentColor' : 'none'}
      strokeWidth={1.75}
      aria-hidden="true"
    >
      <path d="M6 3h12v18l-6-4-6 4z" />
    </svg>
  )
}

export function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...STROKE} strokeWidth={1.75} aria-hidden="true">
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  )
}

export function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...STROKE} strokeWidth={1.75} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

export function OutlineIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} strokeWidth={1.75} aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  )
}

export function MoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  )
}

export function ChevronIcon({ direction }: { direction: 'left' | 'right' | 'down' }) {
  const d = { left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6', down: 'M6 9l6 6 6-6' }[direction]
  return (
    <svg width={direction === 'down' ? 18 : 14} height={direction === 'down' ? 18 : 14} viewBox="0 0 24 24" {...STROKE} strokeWidth={2} aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" {...STROKE} strokeWidth={2} aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}
