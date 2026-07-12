/**
 * Chrome shared by the Topbar's controls and the Download menu it opens.
 * Lives in its own module so DownloadMenu can reuse it without importing from
 * Topbar, which imports DownloadMenu (that would be a cycle).
 */
export const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mauve'

/** The secondary topbar controls (Download, Share) are identical apart from
 *  their icon and label, so their chrome lives here once. */
export const GHOST_BUTTON = `inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border border-line bg-elev px-2.5 py-[5px] text-[11.5px] font-medium text-sub transition-colors hover:border-mauve hover:bg-chip hover:text-text active:bg-mauvesoft ${FOCUS_RING}`
