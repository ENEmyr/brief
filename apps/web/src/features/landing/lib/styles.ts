/**
 * Every focusable control on the page draws the same ring. Keeping the literal
 * in one place is what stops a new link or button from shipping with a
 * near-miss variant of it.
 */
export const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mauve'
