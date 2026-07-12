import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { BLOCK_TYPES } from '../src'

const root = resolve(import.meta.dirname, '../../..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')

const blocksMd = read('skills/brief/BLOCKS.md')
const skillMd = read('skills/brief/SKILL.md')
const docsMd = read('docs/skill.md')
const schema = read('skills/brief/payload.schema.json')

const blockPicker = blocksMd.slice(
  blocksMd.indexOf('## Choosing a block'),
  blocksMd.indexOf('## Text and callouts'),
)

/** Every enum value the schema can accept, harvested from the generated JSON
 * Schema, so a new tone, status, or curve is caught without listing them here. */
function enumValues(node: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) enumValues(item, found)
    return found
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'enum' && Array.isArray(value)) {
        for (const v of value) if (typeof v === 'string') found.add(v)
      } else if (key !== 'const') {
        enumValues(value, found)
      }
    }
  }
  return found
}

/** The skill is the agent-facing contract for this schema, so a schema change
 * that the skill does not describe is a schema change agents will get wrong.
 * These tests fail on exactly that, which is what makes the rule in CLAUDE.md
 * ("update the skill when you change the payload") enforceable rather than
 * something a reviewer has to remember. */
describe('the brief skill tracks the payload schema', () => {
  it.each(BLOCK_TYPES)('BLOCKS.md documents the %s block under its own heading', (type) => {
    const heading = new RegExp('^### .*`' + type + '`', 'm')
    expect(
      heading.test(blocksMd),
      `skills/brief/BLOCKS.md has no heading for the '${type}' block. Add its fields and a valid example.`,
    ).toBe(true)
  })

  it.each(BLOCK_TYPES)('the BLOCKS.md block picker mentions %s', (type) => {
    expect(
      blockPicker.includes('`' + type + '`'),
      `skills/brief/BLOCKS.md's "Choosing a block" table never mentions '${type}', so an agent has no cue for when to reach for it.`,
    ).toBe(true)
  })

  it('BLOCKS.md documents every enum value the schema accepts', () => {
    const missing = [...enumValues(JSON.parse(schema))].filter((v) => !blocksMd.includes(v))
    expect(
      missing,
      `skills/brief/BLOCKS.md never mentions these accepted values: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('SKILL.md states the current number of block types', () => {
    const stated = [...skillMd.matchAll(/(\d+) block types/g)].map((m) => Number(m[1]))
    expect(stated.length, 'SKILL.md no longer states a block type count').toBeGreaterThan(0)
    for (const n of stated) expect(n, 'SKILL.md states a stale block type count').toBe(BLOCK_TYPES.length)
  })

  it.each(BLOCK_TYPES)('docs/skill.md lists the %s block in its table', (type) => {
    expect(
      docsMd.includes('| `' + type + '`'),
      `docs/skill.md's block table is missing '${type}'.`,
    ).toBe(true)
  })
})
