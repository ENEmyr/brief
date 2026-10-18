/** Scrolling between the sections of the document column (`main`). */

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function documentSections(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('main [data-section]')]
}

/** The section element in the document column, or null when the current view does not render it. */
export function findSection(id: string): HTMLElement | null {
  return documentSections().find((el) => el.dataset.section === id) ?? null
}

export function scrollToElement(el: Element, block: ScrollLogicalPosition = 'start'): void {
  el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block })
}

/**
 * Scrolls to the first trajectory card in the document column, opening the
 * details blocks around it first. False when the current view does not render one.
 */
export function scrollToTrajectory(): boolean {
  const tag = [...document.querySelectorAll('main [data-kind-tag]')].find((el) => el.textContent === 'trajectory')
  const card = tag?.closest('figure')
  if (!card) return false
  for (let el = card.parentElement?.closest('details'); el; el = el.parentElement?.closest('details')) el.open = true
  scrollToElement(card)
  return true
}

/**
 * The section J (1) or K (-1) moves to, measured against each card's scroll
 * margin: J goes to the first card whose top is still below that line, K to
 * the last card that starts above it (the start of the current section first).
 */
export function adjacentSectionId(direction: 1 | -1): string | null {
  const sections = documentSections()
  const placed = sections.map((el) => {
    const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0
    return { id: el.dataset.section ?? null, offset: el.getBoundingClientRect().top - margin }
  })
  const target =
    direction === 1
      ? placed.find((s) => s.offset > 1)
      : [...placed].reverse().find((s) => s.offset < -1)
  return target?.id ?? null
}
