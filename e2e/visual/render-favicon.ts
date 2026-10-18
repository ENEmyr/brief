import fs from 'node:fs'
import { chromium } from '@playwright/test'
import { FAVICON_ICO, FAVICON_SIZES, renderIcon, writeIco } from './lib/favicon'

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
