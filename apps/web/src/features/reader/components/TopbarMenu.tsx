'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useDialogFocus } from '@/features/export'
import { FOCUS_RING } from './topbarChrome'

/** B-Components menu rows: 34 high (44 under 880), radius 4, 13px, focused row accent-soft. */
const MENU_ITEM = `flex min-h-[34px] w-full items-center justify-between rounded-[4px] border-0 bg-transparent px-2 text-left text-[13px] text-text transition-colors duration-[var(--dur-fast)] hover:bg-chip focus:bg-accent-soft max-[880px]:min-h-11 ${FOCUS_RING}`

export interface TopbarMenuItem {
  label: string
  run: () => void
}

/**
 * Shell shared by every Topbar dropdown (Download, Edit, and whatever comes
 * next): a trigger button plus a panel of items, with the outside-click,
 * roving-arrow-key, and focus-trap mechanics implemented exactly once. This
 * used to be duplicated per menu, which is how EditMenu inherited two real
 * defects from a pre-fix copy of DownloadMenu (a click-away overlay that
 * never covered the page under Topbar's `backdrop-blur`, and `role="menu"`
 * without the arrow-key navigation menu semantics commit to) -- a review
 * caught both, but only in the copy that got reviewed. Extracting the shell
 * means a new menu built on top of it cannot go stale the same way again.
 *
 * The open menu is split into its own component because useDialogFocus must
 * not run while the menu is closed: the hook grabs focus and registers on the
 * shared dialog stack on mount, so mounting it only when open is what makes
 * "Escape closes the menu and focus returns to the trigger" fall out for
 * free, with the same stacking rules as ShareModal/CopyFallbackModal (a menu
 * open under a modal must not swallow that modal's Escape).
 *
 * Click-away is a document-level `pointerdown` listener registered in this
 * component's own effect, rather than a full-viewport overlay div: an
 * overlay would need to be a fixed-position descendant of Topbar's header,
 * and that header has `backdrop-blur`, which makes it a containing block for
 * fixed-position descendants (CSS Filter Effects spec) -- so `inset-0` on
 * the overlay resolves against the ~56px header box, not the viewport, and
 * a click anywhere in the actual page body never reaches it. A document
 * listener has no containing-block problem: `rootRef` (spanning both the
 * trigger and this panel) is what a click on the trigger button itself is
 * inside of, so re-clicking the trigger is left entirely to the trigger's
 * own onClick toggle rather than being raced by this listener. Attaching on
 * `pointerdown` from THIS effect, which only runs after the panel has
 * mounted -- which is only after the trigger's own click has already
 * finished dispatching -- means it can never fire for the same click that
 * opened the menu; there is no listener to race.
 */
function TopbarMenuPanel({
  label,
  items,
  onClose,
  rootRef,
}: {
  label: string
  items: TopbarMenuItem[]
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
      aria-label={label}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="console-pop absolute right-0 top-[calc(100%+6px)] z-50 flex w-[240px] flex-col rounded-[8px] border border-line2 bg-elev p-1 leading-[normal] shadow-[var(--shadow-overlay)] outline-none"
    >
      {items.map((item, index) => (
        <button
          key={item.label}
          // Focus opens on the first item that actually renders, which is not
          // always the first one in the array: any handler can be absent.
          ref={(el) => {
            itemRefs.current[index] = el
            if (index === 0) firstItemRef.current = el
          }}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose()
            item.run()
          }}
          className={MENU_ITEM}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

/**
 * One Topbar control that opens a dropdown of items. Each handler behind an
 * item is optional at the call site (DownloadMenu, EditMenu, More actions);
 * with an empty `items` array there is nothing to open, so the control
 * renders nothing.
 */
export function TopbarMenu({
  icon,
  triggerLabel,
  triggerClassName,
  items,
}: {
  icon: ReactNode
  triggerLabel: string
  triggerClassName: string
  items: TopbarMenuItem[]
}) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const rootRef = useRef<HTMLDivElement>(null)

  if (items.length === 0) return null

  return (
    <div ref={rootRef} className="relative shrink-0">
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
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className={triggerClassName}
      >
        {icon}
      </button>
      {open && (
        <TopbarMenuPanel
          label={triggerLabel}
          items={items}
          onClose={close}
          rootRef={rootRef}
        />
      )}
    </div>
  )
}
