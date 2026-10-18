/**
 * Every focusable control on the page draws the same ring. Keeping the literal
 * in one place is what stops a new link or button from shipping with a
 * near-miss variant of it.
 */
export const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line'

// B-Landing colors with no token in tokens.css, which only the owner extends:
// the board's dark value and its lightify.py light value.
export const PILL_BORDER = 'border-[#b9d98a] [[data-theme=dark]_&]:border-[#3b4a1c]'
export const PREVIEW_TEXT = 'text-[#2a3036] [[data-theme=dark]_&]:text-[#d5dadd]'
export const LINK = 'text-accent-text hover:text-[#3e6300] [[data-theme=dark]_&]:hover:text-[#dcff8a]'

export const BAND = 'bg-[var(--c-row-zebra)]'

// Under 880 every link and button is a 44 px touch target.
export const NARROW_TARGET =
  'max-[880px]:inline-flex max-[880px]:min-h-11 max-[880px]:min-w-11 max-[880px]:items-center max-[880px]:justify-center'

export const PAD = 'box-border px-8 max-[880px]:px-4'

export const H2 = 'm-0 text-[36px] leading-[40px] font-semibold tracking-[-0.03em]'
