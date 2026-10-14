/**
 * Every focusable control on the page draws the same ring. Keeping the literal
 * in one place is what stops a new link or button from shipping with a
 * near-miss variant of it.
 */
export const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line'

/*
 * B-Landing colors that tokens.css has no token for. The dark value is the
 * board's; the light value is what tools/lightify.py maps it to, the mapping
 * the light boards were made with.
 */
/** The hero pill's border (B-Landing:37). */
export const PILL_BORDER = 'border-[#b9d98a] [[data-theme=dark]_&]:border-[#3b4a1c]'
/** The preview's paragraph text (B-Landing:161). */
export const PREVIEW_TEXT = 'text-[#2a3036] [[data-theme=dark]_&]:text-[#d5dadd]'
/** Plain links: accent text, brighter on hover (B-Landing:14). */
export const LINK = 'text-accent-text hover:text-[#3e6300] [[data-theme=dark]_&]:hover:text-[#dcff8a]'

/** The band behind How it works, the preview and the closing call (#0E1113 on the board). */
export const BAND = 'bg-[var(--c-row-zebra)]'

/** Section padding, 16px at the side under 880 (B-Landing:22 `.bl-pad`). */
export const PAD = 'box-border px-8 max-[880px]:px-4'

/** Section headings (B-Landing:88). */
export const H2 = 'm-0 text-[36px] leading-[40px] font-semibold tracking-[-0.03em]'
