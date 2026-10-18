import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'

const WEB_DIR = path.resolve(import.meta.dirname, '..', '..', '..', 'apps', 'web')
export const ICON_SVG = path.join(WEB_DIR, 'src', 'app', 'icon.svg')
export const FAVICON_ICO = path.join(WEB_DIR, 'public', 'favicon.ico')
export const FAVICON_SIZES = [16, 32, 48] as const

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

// ICONDIR is 6 bytes (reserved, type, count); each ICONDIRENTRY is 16.
const DIR_COUNT = 4
const DIR_SIZE = 6
const ENTRY_SIZE = 16
const ENTRY_WIDTH = 0
const ENTRY_HEIGHT = 1
const ENTRY_PALETTE = 2
const ENTRY_RESERVED = 3
const ENTRY_PLANES = 4
const ENTRY_BITS = 6
const ENTRY_BYTES = 8
const ENTRY_OFFSET = 12
const TYPE_ICON = 1

const entryAt = (i: number) => DIR_SIZE + ENTRY_SIZE * i

export function readIco(ico: Buffer): IcoEntry[] {
  return Array.from({ length: ico.readUInt16LE(DIR_COUNT) }, (_, i) => {
    const entry = entryAt(i)
    const bytes = ico.readUInt32LE(entry + ENTRY_BYTES)
    const offset = ico.readUInt32LE(entry + ENTRY_OFFSET)
    return { size: ico.readUInt8(entry + ENTRY_WIDTH) || 256, png: ico.subarray(offset, offset + bytes) }
  })
}

export function writeIco(entries: IcoEntry[]): Buffer {
  const header = Buffer.alloc(entryAt(entries.length))
  header.writeUInt16LE(TYPE_ICON, 2)
  header.writeUInt16LE(entries.length, DIR_COUNT)
  let offset = header.length
  entries.forEach(({ size, png }, i) => {
    const entry = entryAt(i)
    header.writeUInt8(size >= 256 ? 0 : size, entry + ENTRY_WIDTH)
    header.writeUInt8(size >= 256 ? 0 : size, entry + ENTRY_HEIGHT)
    header.writeUInt8(0, entry + ENTRY_PALETTE)
    header.writeUInt8(0, entry + ENTRY_RESERVED)
    header.writeUInt16LE(1, entry + ENTRY_PLANES)
    header.writeUInt16LE(32, entry + ENTRY_BITS)
    header.writeUInt32LE(png.length, entry + ENTRY_BYTES)
    header.writeUInt32LE(offset, entry + ENTRY_OFFSET)
    offset += png.length
  })
  return Buffer.concat([header, ...entries.map((e) => e.png)])
}
