import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { BLOCK_TYPES } from '../src'

const root = resolve(import.meta.dirname, '../../..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')

const blocksIndex = read('skills/brief/BLOCKS.md')
/** Block docs live one file per block under blocks/, decisions and glossary under reference/. */
const docFiles = ['blocks', 'reference'].flatMap((dir) =>
  readdirSync(resolve(root, 'skills/brief', dir)).map((f) => `${dir}/${f}`),
)
const blocksMd = [blocksIndex, ...docFiles.map((f) => read(`skills/brief/${f}`))].join('\n')
const skillMd = read('skills/brief/SKILL.md')
const docsMd = read('docs/skill.md')
const schema = read('skills/brief/payload.schema.json')

const blockPicker = skillMd.slice(
  skillMd.indexOf('## Choosing blocks'),
  skillMd.indexOf('## Validating the payload'),
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
  it.each(BLOCK_TYPES)('blocks/ documents the %s block under its own heading', (type) => {
    const heading = new RegExp('^#+ .*`' + type + '`', 'm')
    expect(
      heading.test(blocksMd),
      `skills/brief/blocks/ has no file with a heading for the '${type}' block. Add blocks/${type}.md with its fields and a valid example, and list it in BLOCKS.md.`,
    ).toBe(true)
  })

  it.each(BLOCK_TYPES)('the SKILL.md block picker mentions %s', (type) => {
    expect(
      blockPicker.includes('`' + type + '`'),
      `skills/brief/SKILL.md's "Choosing blocks" table never mentions '${type}', so an agent has no cue for when to reach for it.`,
    ).toBe(true)
  })

  it('the block docs mention every enum value the schema accepts', () => {
    const missing = [...enumValues(JSON.parse(schema))].filter((v) => !blocksMd.includes(v))
    expect(
      missing,
      `skills/brief/BLOCKS.md, blocks/ and reference/ never mention these accepted values: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it.each(docFiles)('an agent can find %s from BLOCKS.md or SKILL.md', (file) => {
    expect(
      blocksIndex.includes(file) || skillMd.includes(file),
      `skills/brief/${file} is not named in BLOCKS.md or SKILL.md, so no agent will read it.`,
    ).toBe(true)
  })

  it('every file BLOCKS.md and SKILL.md point to exists', () => {
    const named = [...(blocksIndex + skillMd).matchAll(/(?:blocks|reference)\/[a-z0-9]+\.md/g)].map((m) => m[0])
    const missing = [...new Set(named)].filter((f) => !existsSync(resolve(root, 'skills/brief', f)))
    expect(missing, `BLOCKS.md or SKILL.md point to files that do not exist: ${missing.join(', ')}`).toEqual([])
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
