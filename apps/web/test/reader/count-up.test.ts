import { describe, expect, it } from 'vitest'
import {
  easeConsole,
  formatStatNumber,
  parseStatNumber,
} from '@/features/reader/components/blocks/countUp'

describe('stat count-up numbers', () => {
  it('counts only values that are one number, keeping prefix, grouping, decimals and unit', () => {
    const at = (value: string, progress: number) => {
      const n = parseStatNumber(value)
      return n === null ? null : formatStatNumber(n, progress)
    }
    expect(at('4,800', 1)).toBe('4,800')
    expect(at('4,800', 0.5)).toBe('2,400')
    expect(at('4,800', 0)).toBe('0')
    expect(at('2.4 s', 0.5)).toBe('1.2 s')
    expect(at('0.2%', 0)).toBe('0.0%')
    expect(at('11%', 1)).toBe('11%')
    expect(at('$1,250,000', 0.5)).toBe('$625,000')
    expect(at('-12%', 0.5)).toBe('-6%')
    expect(at('4800', 0.25)).toBe('1200')
  })

  it('leaves ranges, bounds, words and zero alone', () => {
    for (const value of ['±5%', '5–30 ms', '<1 ms', 'exact', 'Q3', 'v2.1', '0', '1,2345', '']) {
      expect(parseStatNumber(value), value).toBeNull()
    }
  })

  it('eases on the --ease-console curve from 0 to 1', () => {
    expect(easeConsole(0)).toBeCloseTo(0, 5)
    expect(easeConsole(1)).toBeCloseTo(1, 5)
    // cubic-bezier(0.3, 0.8, 0.3, 1) is well past halfway at half time.
    expect(easeConsole(0.5)).toBeGreaterThan(0.85)
    expect(easeConsole(0.25)).toBeLessThan(easeConsole(0.5))
  })
})
