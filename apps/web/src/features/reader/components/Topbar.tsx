'use client'
import { useTheme } from '@/features/theme'
import type { SaveStatus } from '@/features/reader-state'
import type { ReaderView } from '../lib/views'
import { DownloadMenu, downloadItems } from './DownloadMenu'
import { EditMenu } from './EditMenu'
import { ProgressBar } from './ProgressBar'
import { SaveChip } from './SaveChip'
import { TopbarMenu } from './TopbarMenu'
import type { TopbarMenuItem } from './TopbarMenu'
import { ViewTabs } from './ViewTabs'
import { ArchiveIcon, MoonIcon, MoreIcon, OutlineIcon, SearchIcon, SunIcon } from './icons'
import { FOCUS_RING, ICON_BUTTON, TOUCH_BUTTON } from './topbarChrome'

/** Hidden under 880, where B-Mobile's bar replaces the wide controls. */
const WIDE = 'max-[880px]:hidden'
/** Shown only under 880. */
const NARROW = 'min-[880px]:hidden'

/**
 * The reader's top bar: B-Reader at 880 and up (52 high), B-Mobile under 880
 * (48 high, section counter, Search and More actions), plus B-Reader's
 * "Open outline" button under 880. Every control is optional, so the status
 * pages render the bar with the logo and theme toggle only.
 */
/** The theme button's label, also used for its palette action. */
export function themeToggleLabel(theme: string): string {
  return theme === 'dark' ? 'Theme: dark. Switch to light' : 'Theme: light. Switch to dark'
}

export function Topbar({
  sessionId,
  title,
  sectionCounter,
  view,
  onViewChange,
  disabledViews,
  paletteHint,
  onOpenPalette,
  saveStatus,
  archived,
  onOpenOutline,
  onSave,
  onEditPrompt,
  onDownload,
  onPrint,
  onShare,
  showProgress,
}: {
  sessionId?: string
  title?: string
  /** "§02 / 04", shown under 880 in place of the title. */
  sectionCounter?: string
  view?: ReaderView
  onViewChange?: (view: ReaderView) => void
  disabledViews?: ReadonlySet<ReaderView>
  /** The palette key hint, "⌘K" on Apple platforms and "Ctrl K" elsewhere. */
  paletteHint?: string
  onOpenPalette?: () => void
  saveStatus?: SaveStatus
  /** Fills the Archive icon once the doc is archived. */
  archived?: boolean
  onOpenOutline?: () => void
  onSave?: () => void
  /** Copies the edit prompt (highlights/notes/questions/decision answers) for
   *  an AI agent to act on; the Edit menu's one live item. */
  onEditPrompt?: () => void
  onDownload?: () => void
  onPrint?: () => void
  onShare?: () => void
  showProgress?: boolean
}) {
  const { theme, toggle } = useTheme()
  const themeLabel = themeToggleLabel(theme)

  const moreItems: TopbarMenuItem[] = []
  if (onEditPrompt) moreItems.push({ label: 'Copy edit prompt', run: onEditPrompt })
  moreItems.push(...downloadItems(onDownload, onPrint))
  if (onSave) moreItems.push({ label: 'Archive', run: onSave })
  moreItems.push({ label: themeLabel, run: toggle })
  if (onShare) moreItems.push({ label: 'Share', run: onShare })

  // Under 880 the save chip only appears when the answers are not on the
  // server, so a phone reader still learns that a reload or another device
  // would lose them.
  const chipOnNarrow = saveStatus === 'device' || saveStatus === 'tab'

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[var(--c-topbar)] leading-[normal] backdrop-blur-[8px] print:hidden">
      <div className="flex h-[52px] items-center gap-[10px] pl-[14px] pr-2 max-[880px]:h-12 max-[880px]:gap-1 max-[880px]:pl-3 max-[880px]:pr-1">
        {onOpenOutline && (
          <button
            type="button"
            onClick={onOpenOutline}
            aria-label="Open outline"
            className={`${TOUCH_BUTTON} -ml-2 ${NARROW}`}
          >
            <OutlineIcon />
          </button>
        )}
        <span
          aria-hidden="true"
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[4px] bg-accent font-mono text-[13px] font-semibold text-on-accent"
        >
          b
        </span>
        {sessionId && (
          <span className={`min-w-0 shrink truncate font-mono text-[13px] text-faint ${WIDE}`}>{sessionId} /</span>
        )}
        {title && (
          <span className={`min-w-0 flex-[0_1_auto] truncate text-[14px] font-medium ${WIDE}`}>{title}</span>
        )}
        {sectionCounter && (
          <span className={`ml-[6px] min-w-0 grow truncate font-mono text-[12px] text-faint ${NARROW}`}>
            {sectionCounter}
          </span>
        )}
        <span className={`grow ${WIDE}`} />
        {view && onViewChange && (
          <ViewTabs view={view} onChange={onViewChange} disabled={disabledViews} className={WIDE} />
        )}
        {onOpenPalette && (
          <>
            <button
              type="button"
              onClick={onOpenPalette}
              className={`flex h-8 min-w-[170px] shrink-0 items-center gap-2 rounded-[4px] border border-line2 bg-card pl-[10px] pr-2 text-[13px] text-faint transition-[transform] duration-[var(--dur-fast)] active:scale-[.97] motion-reduce:transition-none ${FOCUS_RING} ${WIDE}`}
            >
              <SearchIcon size={14} />
              <span className="grow text-left">Jump to...</span>
              <kbd className="font-mono text-[11px] text-sub">{paletteHint}</kbd>
            </button>
            <button
              type="button"
              onClick={onOpenPalette}
              aria-label="Search"
              className={`${TOUCH_BUTTON} ${NARROW}`}
            >
              <SearchIcon size={18} />
            </button>
          </>
        )}
        {saveStatus && <SaveChip status={saveStatus} className={chipOnNarrow ? '' : WIDE} />}
        <div className={`contents ${WIDE}`}>
          <EditMenu onCopyPrompt={onEditPrompt} />
          <DownloadMenu onDownload={onDownload} onPrint={onPrint} />
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              aria-label="Archive"
              title={archived ? 'Archived' : undefined}
              className={ICON_BUTTON}
            >
              <ArchiveIcon filled={!!archived} />
            </button>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={themeLabel}
            data-theme-toggle=""
            className={ICON_BUTTON}
          >
            {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
          </button>
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className={`h-8 shrink-0 rounded-[4px] border-0 bg-text px-3 text-[13px] font-semibold text-card transition-[transform] duration-[var(--dur-fast)] active:scale-[.97] motion-reduce:transition-none [[data-theme=dark]_&]:text-page ${FOCUS_RING}`}
            >
              Share
            </button>
          )}
        </div>
        <div className={`contents ${NARROW}`}>
          <TopbarMenu
            icon={<MoreIcon />}
            triggerLabel="More actions"
            triggerClassName={TOUCH_BUTTON}
            items={moreItems}
          />
        </div>
      </div>
      {showProgress && <ProgressBar />}
    </header>
  )
}
