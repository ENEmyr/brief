import fs from 'node:fs'
import { expect, test } from '@playwright/test'
import { FAVICON_ICO, FAVICON_SIZES, readIco } from '../lib/favicon'

test('favicon.ico holds the icon.svg tile at 16, 32 and 48', ({ colorScheme }) => {
  test.skip(colorScheme === 'light', 'the favicon does not follow the theme')
  const entries = readIco(fs.readFileSync(FAVICON_ICO))
  expect(entries.map((e) => e.size)).toEqual([...FAVICON_SIZES])
  for (const { size, png } of entries) {
    expect.soft(png, `favicon ${size}px`).toMatchSnapshot(`favicon-${size}.png`, { maxDiffPixelRatio: 0.002 })
  }
})
