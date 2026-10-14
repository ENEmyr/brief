'use client'
import { useEffect, useRef, useState } from 'react'

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
  collapsed,
  onToggleCollapsed,
  drawerOpen,
  onCloseDrawer,
}: TocProps) {
  const [hovered, setHovered] = useState(false)
  const drawerPanelRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

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

  // Drawer a11y: on open, remember whatever had focus so it can be restored,
  // and move focus into the panel. Escape closes via the controlling parent's
  // onCloseDrawer. The cleanup below only runs after an open (drawerOpen was
  // true), so it doubles as the "restore focus" step on close.
  useEffect(() => {
    if (!drawerOpen) return

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    drawerPanelRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseDrawer()
        return
      }

      // Simple focus containment: wrap Tab/Shift+Tab between the first and
      // last focusable element inside the drawer panel. Not a full focus-trap
      // (no live re-scan, no iframe/shadow-DOM support) — sufficient given the
      // drawer's small, static set of focusable children.
      if (event.key === 'Tab' && drawerPanelRef.current) {
        const focusable = drawerPanelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (!first || !last) return

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocusedRef.current?.focus()
    }
  }, [drawerOpen, onCloseDrawer])

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

  function renderMarks(rowSize: string) {
    // B-States "No notes": teach the selection toolbar instead of saying "nothing here".
    if (marks.length === 0) {
      return (
        <>
          <div className={DIVIDER} />
          <span className={LABEL}>NOTES 0</span>
          <p className="m-0 px-2 pb-[6px] text-[13px] leading-5 text-sub">
            Select any text to highlight it, add a note, or ask the agent about it.
          </p>
        </>
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
            <span className={LABEL}>OUTLINE</span>
            {renderSections('min-h-11')}
            {renderMarks('min-h-11')}
          </div>
        </div>
      )}
    </>
  )
}
