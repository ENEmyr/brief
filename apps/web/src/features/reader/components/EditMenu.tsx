'use client'
import { useCallback, useRef, useState } from 'react'
import { useDialogFocus } from '@/features/export'
import { FOCUS_RING, GHOST_BUTTON } from './topbarChrome'

const MENU_ITEM = `flex w-full min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[12.5px] font-medium text-text transition-colors hover:bg-chip active:bg-mauvesoft ${FOCUS_RING}`

interface MenuItem {
  icon: string
  label: string
  run: () => void
}

/**
 * The open menu, structured like DownloadMenuPanel: useDialogFocus must not
 * run while the menu is closed, so it only mounts here.
 */
function EditMenuPanel({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const firstItemRef = useRef<HTMLButtonElement>(null)

  useDialogFocus(panelRef, onClose, firstItemRef)

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label="Edit"
      tabIndex={-1}
      className="absolute right-0 top-[calc(100%+6px)] z-50 w-[220px] rounded-xl border border-line bg-card p-1.5 shadow-[var(--shadow-card)] outline-none"
      style={{ animation: 'dc-pop .18s ease' }}
    >
      {items.map((item, index) => (
        <button
          key={item.label}
          ref={index === 0 ? firstItemRef : undefined}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose()
            item.run()
          }}
          className={MENU_ITEM}
        >
          <span aria-hidden="true" className="text-[13px] text-mauve">
            {item.icon}
          </span>
          {item.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Edit control, built the same way as DownloadMenu (useDialogFocus, an item
 * array, the trigger self-focusing on click). Ships with one live item --
 * "Copy edit prompt", which serializes every highlight/note/question and
 * decision answer into a prompt the reader hands to an AI agent -- because
 * the user's other ask, a manual in-place editor, is deferred to its own
 * feature request. Kept as a menu rather than a flat button precisely so
 * that second item can slot in later without restructuring this control.
 */
export function EditMenu({ onCopyPrompt }: { onCopyPrompt?: () => void }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  const items: MenuItem[] = []
  if (onCopyPrompt) items.push({ icon: '⧉', label: 'Copy edit prompt', run: onCopyPrompt })
  if (items.length === 0) return null

  return (
    <div className="relative">
      {/* Click-away layer, same reasoning as DownloadMenu's: covers the
          viewport behind the menu so a click anywhere else dismisses it,
          without a document-level listener that would race the trigger's
          own onClick. */}
      {open && <div className="fixed inset-0 z-40" onClick={close} />}
      <button
        type="button"
        onClick={(event) => {
          // Focus the trigger before the menu mounts: useDialogFocus restores
          // focus to whatever was active when it opened, and a click does not
          // reliably focus a button (Safari does not, and neither does jsdom).
          event.currentTarget.focus()
          setOpen((prev) => !prev)
        }}
        aria-label="Edit"
        aria-haspopup="menu"
        aria-expanded={open}
        className={GHOST_BUTTON}
      >
        <span aria-hidden="true" className="text-[13px] text-mauve">
          ✎
        </span>
        <span className="hidden min-[880px]:inline">Edit</span>
      </button>
      {open && <EditMenuPanel items={items} onClose={close} />}
    </div>
  )
}
