'use client'
import { useEffect, useRef, useState } from 'react'
import { useActiveSection } from '../hooks/useActiveSection'

export interface TocSection {
  id: string
  no: number
  title: string
}

export interface TocProps {
  sections: TocSection[]
  collapsed: boolean
  onToggleCollapsed: () => void
  drawerOpen: boolean
  onCloseDrawer: () => void
}

const pad = (n: number) => String(n).padStart(2, '0')

export function Toc({
  sections,
  collapsed,
  onToggleCollapsed,
  drawerOpen,
  onCloseDrawer,
}: TocProps) {
  const ids = sections.map((s) => s.id)
  const activeId = useActiveSection(ids)
  const [hovered, setHovered] = useState(false)
  const drawerPanelRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  function handleToggleCollapsed() {
    setHovered(false)
    onToggleCollapsed()
  }

  function goToSection(id: string) {
    document.querySelector(`[data-section="${id}"]`)?.scrollIntoView({ behavior: 'smooth' })
    onCloseDrawer()
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

  const showFull = !collapsed || hovered

  function renderItems(showTitle: boolean) {
    return (
      <ul>
        {sections.map((s) => {
          const isActive = s.id === activeId
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => goToSection(s.id)}
                aria-current={isActive ? 'true' : undefined}
                className={`mb-0.5 flex items-center gap-2 whitespace-nowrap rounded-lg border-l-2 px-[9px] py-[5px] text-[12.5px] ${
                  isActive
                    ? 'border-mauve bg-mauvesoft font-semibold text-mauve'
                    : 'border-transparent text-sub'
                }`}
              >
                <span className="shrink-0 font-mono text-[11px]">{pad(s.no)}</span>
                {showTitle && (
                  <>
                    {' '}
                    <span className="overflow-hidden text-ellipsis">{s.title}</span>
                  </>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  function renderCollapsedNumbers() {
    return (
      <ul>
        {sections.map((s) => {
          const isActive = s.id === activeId
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => goToSection(s.id)}
                aria-current={isActive ? 'true' : undefined}
                aria-label={`${s.no}. ${s.title}`}
                className={`block w-full py-1.5 text-center font-mono text-[11px] ${
                  isActive ? 'font-bold text-mauve' : 'text-faint'
                }`}
              >
                {pad(s.no)}
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  function renderDrawerItems() {
    return (
      <ul>
        {sections.map((s) => {
          const isActive = s.id === activeId
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => goToSection(s.id)}
                aria-current={isActive ? 'true' : undefined}
                className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-[9px] text-left text-[14px] ${
                  isActive ? 'bg-mauvesoft text-mauve' : 'text-text'
                }`}
              >
                <span className="font-mono text-faint">{pad(s.no)}</span>
                <span>{s.title}</span>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <>
      <nav
        aria-label="Table of contents"
        className="sticky top-[70px] hidden print:hidden min-[880px]:block"
      >
        <div
          className={collapsed ? 'relative w-12' : undefined}
          onMouseEnter={() => collapsed && setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div
            className={`transition-[box-shadow,width] duration-[180ms] ${
              collapsed
                ? hovered
                  ? 'absolute left-0 top-0 z-10 w-[200px] rounded-xl border border-line bg-card px-2.5 py-3 shadow-[var(--shadow-card)]'
                  : 'w-12 rounded-xl border border-transparent bg-transparent px-1 py-1.5'
                : 'rounded-xl border border-line bg-card px-2.5 py-3'
            }`}
          >
            <div
              className={`mb-2 flex items-center ${showFull ? 'justify-between' : 'justify-center'}`}
            >
              {showFull && (
                <span className="font-mono text-[10px] tracking-[.08em] text-faint">Contents</span>
              )}
              <button
                type="button"
                onClick={handleToggleCollapsed}
                aria-label={collapsed ? 'Expand contents' : 'Collapse contents'}
                className="text-[14px] leading-none text-faint"
              >
                {collapsed ? '»' : '«'}
              </button>
            </div>
            {showFull ? renderItems(true) : renderCollapsedNumbers()}
          </div>
        </div>
      </nav>

      {drawerOpen && (
        <div className="fixed inset-0 z-[60] min-[880px]:hidden" onClick={onCloseDrawer}>
          <div role="presentation" className="absolute inset-0 bg-black/40" />
          <div
            ref={drawerPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Table of contents"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
            className="absolute inset-y-0 left-0 w-[260px] overflow-y-auto bg-card p-4 shadow-[var(--shadow-card)]"
          >
            <div className="mb-3 font-mono text-[11px] text-faint">Contents</div>
            {renderDrawerItems()}
          </div>
        </div>
      )}
    </>
  )
}
