import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NARROW_BELOW_PX } from '@/features/reader/hooks/useIsNarrow'

const SRC = resolve(process.cwd(), 'src')
// B-Reader's dock column starts at 1101; nothing in JS reads it.
const DOCK_COLUMN_FROM_PX = 1101
const WIDTH_VARIANT = /\b(?:min|max)-\[([\d.]+)px\]:/g

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(tsx?|css)$/.test(entry.name) ? [path] : []
  })
}

describe('the 880 breakpoint', () => {
  it('every Tailwind width variant names the number useIsNarrow asks for (or the dock column)', () => {
    const strays: string[] = []
    let narrowVariants = 0
    for (const file of sourceFiles(SRC)) {
      for (const [variant, width] of readFileSync(file, 'utf8').matchAll(WIDTH_VARIANT)) {
        const px = Number(width)
        if (px === NARROW_BELOW_PX) narrowVariants++
        else if (px !== DOCK_COLUMN_FROM_PX) strays.push(`${relative(SRC, file)}: ${variant}`)
      }
    }
    expect(strays).toEqual([])
    expect(narrowVariants).toBeGreaterThan(0)
  })
})
