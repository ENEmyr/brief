'use client'
import { useRef, useState } from 'react'
import { DialogFocus } from '@/features/export'
import { OverlayExit } from '@/shared/OverlayExit'

export interface TocSection {
  id: string
  no: number
  title: string
}

/** One reader highlight listed under "Your marks", by its text. */
export interface TocMark {
  id: string
  sectionId: string
  text: string
  /** Ask marks are lime in the text, so their swatch is a lime outline; the rest are amber. */
  ask: boolean
}

export interface TocProps {
  sections: TocSection[]
  activeId: string | null
  marks: TocMark[]
  /** Sections a still-open decision refers to get a warn dot. Needs decision refs (P1). */
  openSectionIds?: ReadonlySet<string>
  onJump: (sectionId: string) => void
  onMarkJump: (mark: TocMark) => void
  /** The "Agent trail" row. Pass it only when the document has a trajectory block. */
  trail?: { flags: number; onJump: () => void }
  collapsed: boolean
  onToggleCollapsed: () => void
  drawerOpen: boolean
  onCloseDrawer: () => void
}

const pad = (n: number) => String(n).padStart(2, '0')

const ROW = 'flex items-center gap-2 rounded-[4px] px-2 no-underline transition-colors duration-[var(--dur-fast)] hover:bg-chip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line'
const LABEL = 'px-2 py-[6px] font-mono text-[10px] text-faint'
const DIVIDER = 'mx-1 my-2 h-px shrink-0 bg-line'

/**
 * B-Reader's outline: section rows with the current one marked, "Your marks",
 * and a narrow rail when collapsed (owner ruling D5 keeps the collapse). Under
 * 880 the outline hides and the same rows open as a drawer from the top bar.
 * The nav and the drawer are siblings, not nested, so each keeps its own
 * breakpoint (bug-088).
 */
export function Toc({
  sections,
  activeId,
  marks,
  openSectionIds,
  onJump,
  onMarkJump,
  trail,
  collapsed,
  onToggleCollapsed,
  drawerOpen,
  onCloseDrawer,
}: TocProps) {
  const [hovered, setHovered] = useState(false)
  const drawerPanelRef = useRef<HTMLDivElement>(null)

  function handleToggleCollapsed() {
    setHovered(false)
    onToggleCollapsed()
  }

  function jump(event: React.MouseEvent, sectionId: string) {
    event.preventDefault()
    onCloseDrawer()
    onJump(sectionId)
  }

  function jumpToMark(event: React.MouseEvent, mark: TocMark) {
    event.preventDefault()
    onCloseDrawer()
    onMarkJump(mark)
  }

  function renderSections(rowSize: string) {
    return sections.map((s) => {
      const isActive = s.id === activeId
      return (
        <a
          key={s.id}
          href={`#${s.id}`}
          onClick={(event) => jump(event, s.id)}
          aria-current={isActive ? 'true' : undefined}
          className={`${ROW} ${rowSize} ${isActive ? 'bg-chip font-medium text-text' : 'text-sub'}`}
        >
          <span className={`w-[18px] shrink-0 font-mono text-[11px] ${isActive ? 'text-accent-text' : 'text-faint'}`}>
            {pad(s.no)}
          </span>
          <span className="min-w-0 truncate">{s.title}</span>
          {openSectionIds?.has(s.id) && (
            <span
              role="img"
              aria-label="open decisions"
              className="ml-auto h-[6px] w-[6px] shrink-0 rounded-full bg-[var(--c-warn-fill)]"
            />
          )}
        </a>
      )
    })
  }

  function renderTrail(rowSize: string) {
    if (!trail) return null
    return (
      <>
        <div className={DIVIDER} />
        <a
          href="#agent-trail"
          onClick={(event) => {
            event.preventDefault()
            onCloseDrawer()
            trail.onJump()
          }}
          className={`${ROW} ${rowSize} text-sub`}
        >
          <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full bg-info" />
          Agent trail
          <span className="ml-auto font-mono text-[11px] text-warn">
            {trail.flags} {trail.flags === 1 ? 'flag' : 'flags'}
          </span>
        </a>
      </>
    )
  }

  function renderMarks(rowSize: string) {
    // B-States "No notes": teach the selection toolbar instead of saying "nothing here".
    if (marks.length === 0) {
      return (
        <div className="mt-2 flex flex-col gap-2 rounded-panel border border-line bg-card p-[14px]">
          <span className="font-mono text-[11px] text-faint">NOTES 0</span>
          <p className="m-0 text-[13px] leading-5 text-sub">
            Select any text to highlight it, add a note, or ask the agent about it.
          </p>
        </div>
      )
    }
    return (
      <>
        <div className={DIVIDER} />
        <span className={LABEL}>YOUR MARKS</span>
        {marks.map((m) => (
          <a
            key={m.id}
            href={`#${m.sectionId}`}
            onClick={(event) => jumpToMark(event, m)}
            className={`${ROW} ${rowSize} text-sub`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-[2px] ${m.ask ? 'border-[1.5px] border-accent-line' : 'bg-[var(--c-warn-fill)]'}`}
            />
            <span className="min-w-0 truncate">{m.text}</span>
          </a>
        ))}
      </>
    )
  }

  function renderRail() {
    return sections.map((s) => {
      const isActive = s.id === activeId
      return (
        <a
          key={s.id}
          href={`#${s.id}`}
          onClick={(event) => jump(event, s.id)}
          aria-current={isActive ? 'true' : undefined}
          aria-label={`${s.no}. ${s.title}`}
          className={`${ROW} min-h-8 justify-center font-mono text-[11px] ${isActive ? 'bg-chip text-accent-text' : 'text-faint'}`}
        >
          {pad(s.no)}
        </a>
      )
    })
  }

  const toggle = (
    <button
      type="button"
      onClick={handleToggleCollapsed}
      aria-label={collapsed ? 'Expand outline' : 'Collapse outline'}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] text-faint transition-colors duration-[var(--dur-fast)] hover:bg-chip hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
      </svg>
    </button>
  )
  const full = (
    <>
      <div className="flex items-center justify-between pr-[2px]">
        <span className={LABEL}>OUTLINE</span>
        {toggle}
      </div>
      {renderSections('min-h-8')}
      {renderMarks('min-h-8')}
      {renderTrail('min-h-8')}
    </>
  )

  return (
    <>
      <nav
        aria-label="Outline"
        onMouseEnter={() => collapsed && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`flex flex-col rounded-[6px] border border-line bg-card text-[13px] leading-[normal] max-[880px]:hidden min-[1101px]:sticky min-[1101px]:top-16 print:hidden ${
          collapsed ? 'relative flex-[0_0_48px] px-1 py-[6px]' : 'box-content flex-[0_0_236px] p-[6px]'
        }`}
      >
        {collapsed ? (
          <>
            <div className="flex justify-center pb-1">{toggle}</div>
            {renderRail()}
          </>
        ) : (
          full
        )}
        {collapsed && hovered && (
          <div className="absolute left-0 top-0 z-10 box-content flex w-[236px] flex-col rounded-[6px] border border-line bg-card p-[6px] shadow-[var(--shadow-overlay)]">
            {full}
          </div>
        )}
      </nav>

      <OverlayExit open={drawerOpen}>
        {drawerOpen && (
          <div className="fixed inset-0 z-[60] min-[880px]:hidden" onClick={onCloseDrawer}>
            <div role="presentation" className="console-fade absolute inset-0 bg-[var(--c-scrim)]" />
            <div
              ref={drawerPanelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Outline"
              tabIndex={-1}
              onClick={(event) => event.stopPropagation()}
              className="absolute inset-y-0 left-0 flex w-[260px] flex-col overflow-y-auto border-r border-line bg-card p-[6px] text-[14px] leading-[normal] shadow-[var(--shadow-overlay)] outline-none"
            >
              <DialogFocus panelRef={drawerPanelRef} onClose={onCloseDrawer} />
              <span className={LABEL}>OUTLINE</span>
              {renderSections('min-h-11')}
              {renderMarks('min-h-11')}
              {renderTrail('min-h-11')}
            </div>
          </div>
        )}
      </OverlayExit>
    </>
  )
}
