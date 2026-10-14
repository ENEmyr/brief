import type { Page } from '@playwright/test'

/** Families a page needs: `always`, plus `thai` when rendered Thai text is set in a stack that names it. */
export interface FontSet {
  always: readonly string[]
  thai?: string
}

/**
 * What the boards load from Google Fonts. B-States sets one Thai string in a
 * Geist Mono stack, so Thai alone does not make Noto Sans Thai needed.
 */
export const BOARD_FONTS: FontSet = { always: ['Geist', 'Geist Mono'], thai: 'Noto Sans Thai' }

/** The app's next/font families (apps/web/src/app/layout.tsx). Phase 1 replaces them with BOARD_FONTS. */
export const APP_FONTS: FontSet = { always: ['IBM Plex Sans Thai', 'IBM Plex Mono'] }

/**
 * Waits for the fonts, then throws unless every needed family has a loaded face
 * and none of its faces failed. document.fonts.ready also resolves when a font
 * failed, so the faces are inspected. Other families are ignored: next/font's
 * `<family> Fallback` faces point at local fonts this machine may not have.
 */
export async function assertFontsLoaded(page: Page, fonts: FontSet, label: string): Promise<void> {
  const { faces, thaiNeeded } = await page.evaluate(async (thai) => {
    await document.fonts.ready
    let thaiNeeded = false
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node && thai !== null && !thaiNeeded; node = walker.nextNode()) {
      const el = node.parentElement
      thaiNeeded =
        el !== null &&
        /[\u0E00-\u0E7F]/.test(node.textContent ?? '') &&
        el.getClientRects().length > 0 &&
        getComputedStyle(el).fontFamily.includes(thai)
    }
    return {
      faces: [...document.fonts].map((f) => ({ family: f.family.replace(/"/g, ''), status: f.status })),
      thaiNeeded,
    }
  }, fonts.thai ?? null)
  const needed = thaiNeeded && fonts.thai !== undefined ? [...fonts.always, fonts.thai] : fonts.always
  const failed = faces.filter((f) => needed.includes(f.family) && f.status === 'error')
  const missing = needed.filter((family) => !faces.some((f) => f.family === family && f.status === 'loaded'))
  if (failed.length > 0 || missing.length > 0) {
    throw new Error(
      `${label}: fonts not loaded (missing: ${missing.join(', ') || 'none'}; failed faces: ${failed.length}). ` +
        'This is a harness failure (network or font files), not a design difference; refusing to render with fallback fonts.',
    )
  }
}
