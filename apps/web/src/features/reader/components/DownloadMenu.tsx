'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useDialogFocus } from '@/features/export'
import { FOCUS_RING, GHOST_BUTTON } from './topbarChrome'

const MENU_ITEM = `flex w-full min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[12.5px] font-medium text-text transition-colors hover:bg-chip active:bg-mauvesoft ${FOCUS_RING}`

interface MenuItem {
  icon: string
  label: string
  run: () => void
}

/**
 * The open menu, split out because useDialogFocus must not run while the menu
 * is closed: the hook grabs focus and registers on the shared dialog stack on
 * mount, so mounting it only when open is what makes "Escape closes the menu
 * and focus returns to the trigger" fall out for free, with the same stacking
 * rules as ShareModal/CopyFallbackModal (a menu open under a modal must not
 * swallow that modal's Escape).
 *
 * Click-away is a document-level `pointerdown` listener registered in this
 * component's own effect, rather than a full-viewport overlay div: an
 * overlay would need to be a fixed-position descendant of Topbar's header,
 * and that header has `backdrop-blur`, which makes it a containing block for
 * fixed-position descendants (CSS Filter Effects spec) -- so `inset-0` on
 * the overlay resolves against the ~56px header box, not the viewport, and
 * a click anywhere in the actual page body never reaches it. A document
 * listener has no containing-block problem: `rootRef` (passed down from
 * DownloadMenu, spanning both the trigger and this panel) is what a click on
 * the trigger button itself is inside of, so re-clicking the trigger is left
 * entirely to the trigger's own onClick toggle rather than being raced by
 * this listener. Attaching on `pointerdown` from THIS effect, which only
 * runs after the panel has mounted -- which is only after the trigger's own
 * click has already finished dispatching -- means it can never fire for the
 * same click that opened the menu; there is no listener to race.
 */
function DownloadMenuPanel({
  items,
  onClose,
  rootRef,
}: {
  items: MenuItem[]
  onClose: () => void
  rootRef: RefObject<HTMLDivElement | null>
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const firstItemRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  useDialogFocus(panelRef, onClose, firstItemRef)

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return
      onClose()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [onClose, rootRef])

  // Roving arrow-key navigation over the item buttons: `role="menu"` /
  // `role="menuitem"` commits to Up/Down/Home/End moving between items per
  // the ARIA APG menu pattern, which useDialogFocus's Tab-cycle alone does
  // not provide.
  function focusItemAt(index: number) {
    const count = itemRefs.current.length
    const wrapped = ((index % count) + count) % count
    itemRefs.current[wrapped]?.focus()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement)
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusItemAt(current + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        focusItemAt(current - 1)
        break
      case 'Home':
        event.preventDefault()
        focusItemAt(0)
        break
      case 'End':
        event.preventDefault()
        focusItemAt(itemRefs.current.length - 1)
        break
    }
  }

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label="Download"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="absolute right-0 top-[calc(100%+6px)] z-50 w-[190px] rounded-xl border border-line bg-card p-1.5 shadow-[var(--shadow-card)] outline-none"
      style={{ animation: 'dc-pop .18s ease' }}
    >
      {items.map((item, index) => (
        <button
          key={item.label}
          // Focus opens on the first item that actually renders, which is not
          // always the markdown one: either handler can be absent.
          ref={(el) => {
            itemRefs.current[index] = el
            if (index === 0) firstItemRef.current = el
          }}
          type="button"
          role="menuitem"
          onClick={() => {
            // Order is harmless either way here (React 18 batches this
            // setOpen(false), so window.print() -- synchronous -- still
            // runs with the panel present in the DOM); the menu never shows
            // up in the PDF because Topbar carries print:hidden, not
            // because of this ordering.
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
 * One Download control in place of the two separate Markdown and Print / PDF
 * buttons. Both are the same reader intent ("give me this doc as a file"), and
 * collapsing them frees a slot in a topbar that is already tight at the
 * 880px breakpoint where every label hides.
 *
 * Each handler is optional and an absent one drops its menu item; with neither,
 * there is no menu to open and the control does not render at all.
 */
export function DownloadMenu({
  onDownload,
  onPrint,
}: {
  onDownload?: () => void
  onPrint?: () => void
}) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const rootRef = useRef<HTMLDivElement>(null)

  const items: MenuItem[] = []
  if (onDownload) items.push({ icon: '↓', label: 'Markdown (.md)', run: onDownload })
  if (onPrint) items.push({ icon: '⎙', label: 'Print / PDF', run: onPrint })
  if (items.length === 0) return null

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={(event) => {
          // Focus the trigger before the menu mounts: useDialogFocus restores
          // focus to whatever was active when it opened, and a click does not
          // reliably focus a button (Safari does not, and neither does jsdom).
          // Without this, closing the menu would drop focus on <body>.
          event.currentTarget.focus()
          setOpen((prev) => !prev)
        }}
        aria-label="Download"
        aria-haspopup="menu"
        aria-expanded={open}
        className={GHOST_BUTTON}
      >
        <span aria-hidden="true" className="text-[13px] text-mauve">
          ↓
        </span>
        <span className="hidden min-[880px]:inline">Download</span>
      </button>
      {open && <DownloadMenuPanel items={items} onClose={close} rootRef={rootRef} />}
    </div>
  )
}
