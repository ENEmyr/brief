'use client'
import { ThemeToggle } from '@/features/theme'
import { DownloadMenu } from './DownloadMenu'
import { ProgressBar } from './ProgressBar'
import { FOCUS_RING, GHOST_BUTTON } from './topbarChrome'

export function Topbar({
  sessionId,
  repo,
  showProgress,
  savedLabel,
  onMenu,
  onSave,
  onDownload,
  onPrint,
  onShare,
}: {
  sessionId?: string
  repo?: string
  showProgress?: boolean
  /** Mono chip text (e.g. "saved") rendered next to the session chip once the doc has been saved. */
  savedLabel?: string
  onMenu?: () => void
  onSave?: () => void
  /** Markdown export; surfaced as an item of the Download menu. */
  onDownload?: () => void
  /** Print / PDF; also an item of the Download menu. Prop-gated like every
   *  other control, so the propless loading-skeleton Topbar no longer offers
   *  a print button for a document that has not loaded yet. */
  onPrint?: () => void
  onShare?: () => void
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/[.93] backdrop-blur-[8px] print:hidden">
      {showProgress && <ProgressBar />}
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-[28px] py-[11px] max-[879px]:px-[16px] max-[879px]:py-[10px]">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="h-[22px] w-[22px] shrink-0 rounded-[7px]"
            style={{ background: 'linear-gradient(135deg, var(--ctp-mauve), var(--ctp-blue))' }}
          />
          <span className="shrink-0 whitespace-nowrap text-[14px] font-semibold">Brief</span>
          {sessionId && (
            <span className="min-w-0 truncate rounded-md bg-chip px-2 py-0.5 font-mono text-[11px] text-sub">
              session <b className="text-mauve">{sessionId}</b>
            </span>
          )}
          {savedLabel && (
            <span className="shrink-0 rounded-md bg-chip px-2 py-0.5 font-mono text-[11px] text-sub">
              {savedLabel}
            </span>
          )}
        </div>
        {/* shrink-0 so the controls keep their full width and the left cluster
            (which can truncate) absorbs a narrow viewport instead. */}
        <div className="flex shrink-0 items-center gap-2">
          {repo && (
            <span className="hidden max-w-[220px] items-center gap-1 truncate rounded-lg border border-line bg-elev px-2.5 py-[5px] font-mono text-[11.5px] font-medium text-sub min-[880px]:inline-flex">
              <span aria-hidden="true" className="text-faint">
                ⎇
              </span>
              {repo}
            </span>
          )}
          {onMenu && (
            <button
              type="button"
              onClick={onMenu}
              aria-label="Open contents"
              className={`flex h-11 w-11 items-center justify-center rounded-lg text-sub transition-colors hover:bg-chip hover:text-text min-[880px]:hidden ${FOCUS_RING}`}
            >
              ☰
            </button>
          )}
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              aria-label="Save"
              className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border-0 bg-mauve px-2.5 py-[5px] text-[11.5px] font-semibold text-white transition hover:brightness-110 active:brightness-95 ${FOCUS_RING}`}
            >
              <span className="text-[13px]">⛉</span>
              <span className="hidden min-[880px]:inline">Save</span>
            </button>
          )}
          <DownloadMenu onDownload={onDownload} onPrint={onPrint} />
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              aria-label="Share"
              className={GHOST_BUTTON}
            >
              <span className="text-[13px] text-mauve">⇗</span>
              <span className="hidden min-[880px]:inline">Share</span>
            </button>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
