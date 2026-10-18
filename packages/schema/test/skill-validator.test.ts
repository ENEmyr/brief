import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync, symlinkSync, rmSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { payloadSchema, type Payload } from '../src'
import { emitSkillSchema, SKILL_SCHEMA_PATH } from '../scripts/emit-skill-schema'
import { validatePayload, readabilityHints } from '../../../skills/brief/validate.mjs'

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
    name: 'a trajectory step time without Z',
    mutate: (p) => {
      p.sections[0]!.blocks[0] = { type: 'trajectory', steps: [{ at: '2026-07-12T09:00:00+07:00', kind: 'run', title: 'x' }] }
    },
    valid: false,
  },
  {
    name: 'a trajectory step time in UTC',
    mutate: (p) => {
      p.sections[0]!.blocks[0] = { type: 'trajectory', steps: [{ at: '2026-07-12T09:00:00.250Z', kind: 'run', title: 'x' }] }
    },
    valid: true,
  },
  {
    name: 'an image whose imageId is a URL',
    mutate: (p) => {
      p.sections[0]!.blocks[0] = { type: 'image', imageId: 'https://example.com/a.png', alt: 'x' }
    },
    valid: false,
  },
  {
    name: 'an image with an id the API issued',
    mutate: (p) => {
      p.sections[0]!.blocks[0] = { type: 'image', imageId: 'aB3xYz01qWe9rT_-', alt: 'x' }
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

describe("the offline validator's readability hints", () => {
  const withBlock = (block: Payload['sections'][number]['blocks'][number]): Payload => {
    const payload = clone()
    payload.sections[0]!.blocks[0] = block
    return payload
  }
  const paragraph = (text: string) => withBlock({ type: 'p', text })

  it('finds nothing to flag in the shipped example', () => {
    expect(readabilityHints(clone())).toEqual([])
  })

  it('flags a paragraph too long to read in one pass, and accepts one at the limit', () => {
    expect(readabilityHints(paragraph('a'.repeat(400)))).toEqual([])
    expect(readabilityHints(paragraph('a'.repeat(401)))).toEqual([
      {
        path: 'sections.0.blocks.0.text',
        message:
          '401 characters in one paragraph. Keep one point per paragraph: split it, or move the supporting detail into a table or a details block.',
      },
    ])
  })

  it('flags an English sentence over the ASD-STE100 limit of 25 words', () => {
    const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ')
    expect(readabilityHints(paragraph(`${words(25)}.`))).toEqual([])
    const hints = readabilityHints(paragraph(`Short one. ${words(26)}. Another short one.`))
    expect(hints).toHaveLength(1)
    expect(hints[0]!.message).toMatch(/^26 words in one sentence \("w0 w1 w2/)
  })

  it('leaves Thai sentences to the writer, since it cannot count Thai words', () => {
    const thai = 'งานล้างข้อมูลลบแถวที่หมดอายุทุกวัน '.repeat(10)
    expect(readabilityHints(paragraph(thai.trim()))).toEqual([])
  })

  it('flags a table cell that holds a paragraph', () => {
    const hints = readabilityHints(withBlock({ type: 'table', head: ['Finding'], rows: [['a'.repeat(200)], ['b'.repeat(201)]] }))
    expect(hints.map((h) => h.path)).toEqual(['sections.0.blocks.0.rows.1.0'])
    expect(hints[0]!.message).toMatch(/^201 characters in one table cell\./)
  })

  it('flags a stat tile whose label or hint is a sentence', () => {
    const hints = readabilityHints(
      withBlock({
        type: 'stat',
        items: [
          { label: 'CPU at 10,000 students', value: '83%', hint: 'Estimate' },
          { label: 'After', value: '77%', hint: 'Estimated from the refit, warm plan cache, bcrypt cost 10 kept' },
        ],
      }),
    )
    expect(hints.map((h) => h.path)).toEqual(['sections.0.blocks.0.items.1.hint'])
  })

  it('names the file path it found in running text', () => {
    const hints = readabilityHints(paragraph('The handler in apps/api/src/index.ts writes the row.'))
    expect(hints.map((h) => h.path)).toEqual(['sections.0.blocks.0.text'])
    expect(hints[0]!.message).toMatch(/^File path in running text \(apps\/api\/src\/index\.ts\)\./)
  })

  it.each(['~/notes', './run.sh', '/mnt/nas/documents'])('treats %s as a file path', (path) => {
    expect(readabilityHints(paragraph(`Mounted at ${path} today.`))).toHaveLength(1)
  })

  it.each([
    'POST /api/session/:id/raw',
    'and/or',
    'TCP/IP',
    'dev/staging/prod',
    '14/10/2026',
    'https://brief.algoryth.me/s/abc/page.ts',
    'code.claude.com/docs/en/hooks',
  ])('does not mistake %s for a file path', (text) => {
    expect(readabilityHints(paragraph(`Read ${text} first.`))).toEqual([])
  })

  it('flags markdown in any text the reader sees, since Brief renders it as typed', () => {
    const hints = readabilityHints(
      withBlock({ type: 'table', head: ['Field', 'Use'], rows: [['`tone`', 'Colour of the tile']] }),
    )
    expect(hints.map((h) => h.path)).toEqual(['sections.0.blocks.0.rows.0.0'])
  })

  it('accepts inline code, bold and italic in paragraphs and callouts, which the reader renders', () => {
    expect(readabilityHints(paragraph('Set `tone` to **bad** for a *failing* row.'))).toEqual([])
    expect(readabilityHints(withBlock({ type: 'warn', title: 'Use `tone`', text: 'Not **color**.' }))).toEqual([])
    expect(readabilityHints(paragraph('See [the docs](https://brief.algoryth.me).')).map((h) => h.path)).toEqual([
      'sections.0.blocks.0.text',
    ])
  })

  it('accepts inline code, bold and italic in list items, which the reader renders, but not links', () => {
    const list = (item: string) => withBlock({ type: 'list', items: ['Plain item', item] })
    expect(readabilityHints(list('Set `tone` to **bad** for a *failing* row.'))).toEqual([])
    const link = readabilityHints(list('See [the docs](https://brief.algoryth.me).'))
    expect(link.map((h) => h.path)).toEqual(['sections.0.blocks.0.items.1'])
    expect(link[0]!.message).toMatch(/this link shows as literal characters/)
    const cell = readabilityHints(withBlock({ type: 'table', head: ['Field'], rows: [['Set `tone` to **bad**']] }))
    expect(cell.map((h) => h.path)).toEqual(['sections.0.blocks.0.rows.0.0'])
    expect(cell[0]!.message).toMatch(/this markdown shows as literal characters/)
  })

  it('scans a payload-sized unbroken run in linear time', () => {
    const run = 'a'.repeat(1_900_000)
    const hints = readabilityHints(paragraph(`${run} x/y.ts`))
    expect(hints.map((h) => h.path)).toEqual(['sections.0.blocks.0.text', 'sections.0.blocks.0.text'])
    expect(hints[1]!.message).toContain('(x/y.ts)')
    expect(readabilityHints(withBlock({ type: 'note', text: `[${run}](${run}` }))).toHaveLength(1)
  })

  it('leaves code alone', () => {
    expect(readabilityHints(withBlock({ type: 'code', language: 'md', code: '**bold** and `tick`' }))).toEqual([])
  })

  it('reads paragraphs inside a details block and the text of decisions', () => {
    const payload = withBlock({
      type: 'details',
      summary: 'Evidence',
      blocks: [{ type: 'p', text: 'See apps/web/src/page.tsx for the call.' }],
    })
    payload.decisions[0]!.opts[0]!.detail = 'x'.repeat(401)
    expect(readabilityHints(payload).map((h) => h.path)).toEqual([
      'sections.0.blocks.0.blocks.0.text',
      'decisions.0.opts.0.detail',
    ])
  })

  it('prints hints without failing the run, because the API does not check them', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'brief-hints-'))
    const file = join(tmp, 'payload.json')
    writeFileSync(file, JSON.stringify(paragraph('a'.repeat(401))))
    try {
      const run = spawnSync(process.execPath, [resolve(skillDir, 'validate.mjs'), file], { encoding: 'utf8' })
      expect(run.status).toBe(0)
      expect(run.stderr).toContain('hint     sections.0.blocks.0.text: 401 characters')
      expect(run.stdout).toContain('1 readability hint(s).')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
