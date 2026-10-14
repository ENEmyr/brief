/**
 * Chrome shared by the Topbar's controls and the menus it opens.
 * Lives in its own module so the menus can reuse it without importing from
 * Topbar, which imports them (that would be a cycle).
 */
export const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line'

/** B-Reader top bar buttons: transparent, `sub`, radius 4, press scale .97. */
const BAR_BUTTON = `flex shrink-0 items-center justify-center rounded-[4px] border-0 bg-transparent transition-[background-color,transform] duration-[var(--dur-fast)] hover:bg-chip active:scale-[.97] motion-reduce:transition-none ${FOCUS_RING}`

/** The 32px icon buttons of the wide top bar (Edit, Download, Archive, theme). */
export const ICON_BUTTON = `h-8 w-8 text-sub ${BAR_BUTTON}`

/** The 44px buttons of the narrow top bar (B-Mobile: Search, More actions). */
export const TOUCH_BUTTON = `h-11 w-11 text-text ${BAR_BUTTON}`
