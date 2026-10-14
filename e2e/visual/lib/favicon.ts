import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'

const WEB_DIR = path.resolve(import.meta.dirname, '..', '..', '..', 'apps', 'web')
export const ICON_SVG = path.join(WEB_DIR, 'src', 'app', 'icon.svg')
export const FAVICON_ICO = path.join(WEB_DIR, 'public', 'favicon.ico')
export const FAVICON_SIZES = [16, 32, 48] as const

/** icon.svg drawn at size x size on a transparent background, at DPR 1. */
export async function renderIcon(page: Page, size: number): Promise<Buffer> {
  const svg = fs.readFileSync(ICON_SVG).toString('base64')
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<body style="margin:0"><img src="data:image/svg+xml;base64,${svg}" width="${size}" height="${size}" style="display:block"></body>`,
  )
  await page.locator('img').evaluate((img: HTMLImageElement) => img.decode())
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
}

export interface IcoEntry {
  size: number
  png: Buffer
}

/** The PNG images inside an .ico file (ICONDIR, then one 16-byte ICONDIRENTRY per image). */
export function readIco(ico: Buffer): IcoEntry[] {
  const count = ico.readUInt16LE(4)
  return Array.from({ length: count }, (_, i) => {
    const entry = 6 + 16 * i
    const width = ico.readUInt8(entry) || 256
    const bytes = ico.readUInt32LE(entry + 8)
    const offset = ico.readUInt32LE(entry + 12)
    return { size: width, png: ico.subarray(offset, offset + bytes) }
  })
}

/** An .ico holding each PNG as is, which every current browser reads. */
export function writeIco(entries: IcoEntry[]): Buffer {
  const header = Buffer.alloc(6 + 16 * entries.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)
  let offset = header.length
  entries.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i
    header.writeUInt8(size >= 256 ? 0 : size, entry)
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1)
    header.writeUInt8(0, entry + 2)
    header.writeUInt8(0, entry + 3)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...entries.map((e) => e.png)])
}
