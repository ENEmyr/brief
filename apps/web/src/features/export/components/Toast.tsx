'use client'

/**
 * Bottom-center pill (prototype Reader.dc.html lines 753-754). Purely
 * presentational -- ExportProvider owns the message state and the 1600ms
 * auto-dismiss timer. `role="status" aria-live="polite"` so assistive tech
 * announces "Copied" etc. without stealing focus.
 */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ animation: 'dc-floatpop .18s ease' }}
      className="fixed bottom-6 left-1/2 z-[110] -translate-x-1/2 rounded-[9px] bg-elev px-[18px] py-[9px] text-[13px] text-text shadow-[var(--shadow-overlay)] print:hidden"
    >
      {message}
    </div>
  )
}
