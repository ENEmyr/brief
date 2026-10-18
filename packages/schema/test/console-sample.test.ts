import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { payloadSchema, type Payload } from '../src'
import { validatePayload } from '../../../skills/brief/validate.mjs'

const fixtureDir = resolve(import.meta.dirname, '../../../e2e/visual/fixtures')
const readJson = (file: string) => JSON.parse(readFileSync(resolve(fixtureDir, file), 'utf8'))

const skillSchema = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../../skills/brief/payload.schema.json'), 'utf8'),
)

const sample = readJson('brief-sample.payload.json') as Payload
const seed = readJson('reader-state.seed.json') as {
  dsel: Record<string, string[]>
  highlights: { sid: number; bid: number; path: string; start: number; end: number; text: string }[]
}

describe('Console visual suite fixtures', () => {
  it('the B-Reader sample brief passes payloadSchema', () => {
    const result = payloadSchema.safeParse(sample)
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true)
  })

  it('the sample brief passes the skill validator', () => {
    expect(validatePayload(sample, skillSchema).errors).toEqual([])
  })

  it('has sections 01 to 04 and decisions D1 to D4', () => {
    expect(sample.sections.map((s) => s.no)).toEqual([1, 2, 3, 4])
    expect(sample.decisions.map((d) => d.id)).toEqual(['D1', 'D2', 'D3', 'D4'])
  })

  it('the seed answers name real options, except the Other option of D2', () => {
    for (const [id, picked] of Object.entries(seed.dsel)) {
      const decision = sample.decisions.find((d) => d.id === id)
      expect(decision, id).toBeDefined()
      const known = decision!.opts.map((o) => o.id)
      for (const opt of picked) {
        if (id === 'D2' && opt === 'other') continue
        expect(known, `${id}/${opt}`).toContain(opt)
      }
    }
  })

  it('the seeded highlight points at its text in the payload', () => {
    for (const h of seed.highlights) {
      const block = sample.sections[h.sid]!.blocks[h.bid] as { text: string }
      expect(block.text.slice(h.start, h.end)).toBe(h.text)
    }
  })
})
