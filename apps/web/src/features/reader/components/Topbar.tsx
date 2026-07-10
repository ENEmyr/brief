'use client'
import { ThemeToggle } from '@/features/theme'
import { ProgressBar } from './ProgressBar'

export function Topbar({
  sessionId,
  repo,
  showProgress,
  onMenu,
}: {
  sessionId?: string
  repo?: string
  showProgress?: boolean
  onMenu?: () => void
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/[.93] backdrop-blur-[8px] print:hidden">
      {showProgress && <ProgressBar />}
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-[28px] py-[11px] max-[879px]:px-[16px] max-[879px]:py-[10px]">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-[22px] w-[22px] rounded-[7px]"
            style={{ background: 'linear-gradient(135deg, var(--ctp-mauve), var(--ctp-blue))' }}
          />
          <span className="whitespace-nowrap text-[14px] font-semibold">Brief</span>
          {sessionId && (
            <span className="rounded-md bg-chip px-2 py-0.5 font-mono text-[11px] text-sub">
              session <b className="text-mauve">{sessionId}</b>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {repo && (
            <span className="hidden items-center gap-1 rounded-lg border border-line bg-elev px-2.5 py-[5px] font-mono text-[11.5px] font-medium text-sub min-[880px]:inline-flex">
              <span className="text-faint">⎇</span>
              {repo}
            </span>
          )}
          {onMenu && (
            <button
              type="button"
              onClick={onMenu}
              aria-label="Open contents"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-sub min-[880px]:hidden"
            >
              ☰
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            aria-label="Print / PDF"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-elev px-2.5 py-[5px] text-[11.5px] font-medium text-sub"
          >
            <span className="text-[13px] text-mauve">⎙</span>
            <span className="hidden min-[880px]:inline">Print / PDF</span>
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
