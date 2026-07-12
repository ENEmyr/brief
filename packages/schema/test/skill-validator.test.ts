import { describe, it, expect } from 'vitest'
import { readFileSync, mkdtempSync, symlinkSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { payloadSchema, type Payload } from '../src'
import { emitSkillSchema, SKILL_SCHEMA_PATH } from '../scripts/emit-skill-schema'
import { validatePayload } from '../../../skills/brief/validate.mjs'

const skillDir = resolve(import.meta.dirname, '../../../skills/brief')
const readJson = (file: string) => JSON.parse(readFileSync(resolve(skillDir, file), 'utf8'))

const schema = readJson('payload.schema.json')
const example = readJson('example.payload.json') as Payload

const clone = () => structuredClone(example)

/** Cases that hit the constructs where a hand-written JSON Schema engine is
 * most likely to disagree with Zod: nested unions, tuples, enums, min lengths,
 * and unknown keys (which Zod strips rather than rejects). */
const corpus: { name: string; mutate: (p: Payload) => void; valid: boolean }[] = [
  { name: 'the example as shipped', mutate: () => {}, valid: true },
  {
    name: 'empty string where a label is required',
    mutate: (p) => {
      p.decisions[0]!.cmp!.head[0] = ''
    },
    valid: false,
  },
  {
    name: 'a decision with one option',
    mutate: (p) => {
      p.decisions[0]!.opts = [p.decisions[0]!.opts[0]!]
    },
    valid: false,
  },
  {
    name: 'a seq with one actor',
    mutate: (p) => {
      p.sections[1]!.blocks[1] = { type: 'seq', actors: ['Only'], steps: [{ from: 'Only', to: 'Only', label: 'x' }] }
    },
    valid: false,
  },
  {
    name: 'a stat tone outside the palette',
    mutate: (p) => {
      // @ts-expect-error deliberately invalid tone
      p.sections[0]!.blocks[1] = { type: 'stat', items: [{ label: 'a', value: '1', tone: 'purple' }] }
    },
    valid: false,
  },
  {
    name: 'a bigo curve outside the enum',
    mutate: (p) => {
      // @ts-expect-error deliberately invalid curve
      p.sections[0]!.blocks[0] = { type: 'bigo', series: [{ label: 'scan', curve: 'O(n^2)' }] }
    },
    valid: false,
  },
  {
    name: 'a number in a table cell',
    mutate: (p) => {
      // @ts-expect-error cells are strings
      p.sections[1]!.blocks[0]!.rows[0][1] = 48120
    },
    valid: false,
  },
  {
    name: 'a details nested inside a details',
    mutate: (p) => {
      p.sections[1]!.blocks[2] = {
        type: 'details',
        summary: 'outer',
        // @ts-expect-error details may not nest
        blocks: [{ type: 'details', summary: 'inner', blocks: [{ type: 'p', text: 'x' }] }],
      }
    },
    valid: false,
  },
  {
    name: 'a scatter point as an object instead of a tuple',
    mutate: (p) => {
      // @ts-expect-error points are [x, y] tuples
      p.sections[0]!.blocks[0] = { type: 'scatter', series: [{ label: 's', points: [{ x: 1, y: 2 }] }] }
    },
    valid: false,
  },
  {
    name: 'an unknown block type',
    mutate: (p) => {
      // @ts-expect-error blink is not a block
      p.sections[0]!.blocks[0] = { type: 'blink', text: 'x' }
    },
    valid: false,
  },
  {
    name: 'a cmp carrying a type key (Zod strips it)',
    mutate: (p) => {
      // @ts-expect-error cmp is a table minus its type
      p.decisions[0]!.cmp!.type = 'table'
    },
    valid: true,
  },
  {
    name: 'an invented field on a block (Zod strips it)',
    mutate: (p) => {
      // @ts-expect-error invented field
      p.sections[0]!.blocks[0]!.footnote = 'see below'
    },
    valid: true,
  },
]

describe('payload.schema.json', () => {
  it('matches what payloadSchema generates today', () => {
    const committed = readFileSync(SKILL_SCHEMA_PATH, 'utf8')
    expect(
      committed,
      'skills/brief/payload.schema.json is stale. Regenerate it with `bun run gen:skill-schema` in packages/schema.',
    ).toBe(emitSkillSchema())
  })
})

describe("the brief skill's offline validator", () => {
  it.each(corpus)('agrees with payloadSchema on $name', ({ mutate, valid }) => {
    const payload = clone()
    mutate(payload)

    const zodAccepts = payloadSchema.safeParse(payload).success
    const validatorAccepts = validatePayload(payload, schema).errors.length === 0

    expect(zodAccepts).toBe(valid)
    expect(validatorAccepts).toBe(zodAccepts)
  })

  it('warns about invented fields rather than rejecting them, as the API strips them', () => {
    const payload = clone()
    // @ts-expect-error invented field
    payload.sections[0]!.blocks[0]!.footnote = 'see below'

    const { errors, warnings } = validatePayload(payload, schema)
    expect(errors).toHaveLength(0)
    expect(warnings.map((w) => w.path)).toContain('sections.0.blocks.0.footnote')
  })

  it('names the failing path the way the API does', () => {
    const payload = clone()
    payload.decisions[0]!.cmp!.head[0] = ''

    const { errors } = validatePayload(payload, schema)
    expect(errors[0]!.path).toBe('decisions.0.cmp.head.0')
  })

  /** A skill directory is commonly a symlink into a dotfiles repo. If the
   * script's entry-point check compares unresolved paths, it silently does
   * nothing and exits 0, which an agent reads as "the payload is fine". */
  it('still runs when invoked through a symlinked skill directory', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'brief-skill-'))
    const linked = join(tmp, 'brief')
    symlinkSync(skillDir, linked)

    try {
      const out = execFileSync(
        process.execPath,
        [join(linked, 'validate.mjs'), join(linked, 'example.payload.json')],
        { cwd: tmpdir(), encoding: 'utf8' },
      )
      expect(out).toContain('Valid.')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
