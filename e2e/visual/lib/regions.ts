/**
 * Selectors for the B-Reader regions, shared by the reference renderer (run
 * against the board) and the visual specs (run against the app). They are the
 * contract the Console shell has to meet: the same landmarks must exist in the
 * app. Keyed on the board's accessible names, not on the board's own markup.
 */
export const READER_REGIONS = {
  topbar: 'header',
  outline: 'nav[aria-label="Outline"]',
  s1: 'section#s1',
  s2: 'section#s2',
  s3: 'section#s3',
  s4: 'section#s4',
  dock: 'aside[aria-label="Decision dock"]',
} as const

export type ReaderRegion = keyof typeof READER_REGIONS

export const READER_WIDTHS = [1440, 1100, 880] as const
export const THEMES = ['dark', 'light'] as const
export type Theme = (typeof THEMES)[number]

export const BOARD_FOR_THEME: Record<Theme, { reader: string; mobile: string }> = {
  dark: { reader: 'B-Reader', mobile: 'B-Mobile' },
  light: { reader: 'B-Reader-Light', mobile: 'B-Mobile-Light' },
}

/**
 * The phone screen inside a B-Mobile frame, relative to the frame's outer box
 * (390x844, 1px border, radius 36). The app screen starts 44px below the
 * frame's inner top (status-bar offset). The bottom 35px (the inner corner
 * radius) is left out: the rounded corners would carry about 0.17% of backdrop
 * pixels, almost the whole 0.002 budget, before the app is measured.
 */
export const PHONE_SCREEN = { x: 1, y: 45, width: 388, height: 763 } as const
