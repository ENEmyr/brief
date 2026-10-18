import { expect, type Locator } from '@playwright/test'

export interface Box {
  x?: number
  y?: number
  width?: number
  height?: number
}

/**
 * Asserts the locator's bounding box (page coordinates, border box) against
 * the numbers measured on the board, each within `tolerance` px (default 1).
 */
export async function expectBox(locator: Locator, expected: Box, tolerance = 1): Promise<void> {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  expect(box, 'element has no bounding box').not.toBeNull()
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    const want = expected[key]
    if (want === undefined) continue
    expect(Math.abs(box![key] - want), `${key}: got ${box![key]}, board has ${want}`).toBeLessThanOrEqual(tolerance)
  }
}

/** Asserts exact computed CSS values (colors as the browser serialises them, e.g. "rgb(17, 20, 23)"). */
export async function expectComputed(locator: Locator, styles: Record<string, string>): Promise<void> {
  for (const [property, value] of Object.entries(styles)) {
    await expect(locator, property).toHaveCSS(property, value)
  }
}
