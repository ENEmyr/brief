'use client'
import { useEffect, useState } from 'react'
import { useActiveSection } from '../hooks/useActiveSection'

export interface TocSection {
  id: string
  no: number
  title: string
}

const STORAGE_KEY = 'idocs:toc'

function readStoredCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'closed'
  } catch {
    return false
  }
}

function storeCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? 'closed' : 'open')
  } catch {
    // private mode: collapse state just does not persist
  }
}

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M4 6h16M4 12h16M4 18h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export function Toc({ sections }: { sections: TocSection[] }) {
  const ids = sections.map((s) => s.id)
  const activeId = useActiveSection(ids)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setCollapsed(readStoredCollapsed())
  }, [])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      storeCollapsed(next)
      return next
    })
  }

  function goToSection(id: string) {
    document.querySelector(`[data-section="${id}"]`)?.scrollIntoView({ behavior: 'smooth' })
    setMobileOpen(false)
  }

  function renderItems(showTitleAlways: boolean) {
    return (
      <ul className="space-y-1 px-2 py-2">
        {sections.map((s) => {
          const isActive = s.id === activeId
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => goToSection(s.id)}
                aria-current={isActive ? 'true' : undefined}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-surface0 font-medium text-text'
                    : 'text-subtext0 hover:bg-surface0 hover:text-text'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full ${isActive ? 'bg-mauve' : 'bg-overlay0'}`}
                />
                <span
                  className={
                    showTitleAlways
                      ? 'truncate'
                      : 'truncate opacity-0 transition-opacity group-hover:opacity-100'
                  }
                >
                  {s.no}. {s.title}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <nav aria-label="Table of contents">
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open table of contents"
        className="fixed left-3 top-1.5 z-20 flex h-11 w-11 items-center justify-center rounded-lg text-subtext0 hover:bg-surface0 hover:text-text lg:hidden"
      >
        <HamburgerIcon />
      </button>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            role="presentation"
            className="absolute inset-0 bg-crust/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[80%] overflow-y-auto bg-mantle p-3 shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close table of contents"
              className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg text-subtext0 hover:bg-surface0 hover:text-text"
            >
              <CloseIcon />
            </button>
            {renderItems(true)}
          </div>
        </div>
      )}

      {/* Desktop rail */}
      <div
        className={`group fixed inset-y-14 left-0 z-20 hidden flex-col overflow-hidden border-r border-surface0 bg-mantle transition-[width] duration-150 lg:flex ${
          collapsed ? 'w-12 hover:w-64' : 'w-64'
        }`}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand table of contents' : 'Collapse table of contents'}
          className="flex h-11 w-11 shrink-0 items-center justify-center self-end text-subtext0 hover:bg-surface0 hover:text-text"
        >
          <ChevronIcon direction={collapsed ? 'right' : 'left'} />
        </button>
        {renderItems(!collapsed)}
      </div>
    </nav>
  )
}
