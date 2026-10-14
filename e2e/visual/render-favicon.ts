import fs from 'node:fs'
import { chromium } from '@playwright/test'
import { FAVICON_ICO, FAVICON_SIZES, renderIcon, writeIco } from './lib/favicon'

// Writes apps/web/public/favicon.ico from apps/web/src/app/icon.svg, one PNG per
// size, rendered in Playwright's Chromium. Run from the repo root:
//   bun e2e/visual/render-favicon.ts
// tests/favicon.visual.spec.ts checks the result against fresh renders.
const browser = await chromium.launch()
try {
  const page = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage()
  const entries = []
  for (const size of FAVICON_SIZES) entries.push({ size, png: await renderIcon(page, size) })
  fs.writeFileSync(FAVICON_ICO, writeIco(entries))
  console.log(`wrote ${FAVICON_ICO} (${FAVICON_SIZES.join(', ')} px)`)
} finally {
  await browser.close()
}
