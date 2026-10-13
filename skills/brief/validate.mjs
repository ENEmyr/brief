#!/usr/bin/env node
/**
 * Offline pre-flight check for a Brief payload.
 *
 *   node validate.mjs path/to/payload.json
 *
 * Reads payload.schema.json, which is generated from the same Zod schema the
 * API validates with (packages/schema/src/payload.ts in ENEmyr/brief), so the
 * rules here cannot drift from the rules on the server. Accepts either the
 * bare payload or the {"payload": ...} request envelope.
 *
 * Exit 0 means the payload passes every rule the API enforces. Exit 1 prints
 * one `path: message` line per problem, in the same shape as the API's 400.
 *
 * It also prints `hint` lines about readability: a paragraph too long to read
 * in one pass, a table cell or stat tile holding a sentence, a file path in
 * running text, markdown the reader shows as raw characters. Hints never
 * change the exit code; the API does not check them.
 */
import { readFileSync, realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MAX_PAYLOAD_BYTES = 1_900_000
const SCHEMA_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'payload.schema.json')

function typeOf(v) {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v
}

function matchesType(v, t) {
  if (t === 'integer') return typeof v === 'number' && Number.isInteger(v)
  return typeOf(v) === t
}

function joinPath(base, key) {
  return base ? `${base}.${key}` : String(key)
}

/** A union whose members are themselves unions (blockSchema is a union of the
 * 21 non-details blocks and the details block) nests one anyOf inside another,
 * so branches must be flattened before a discriminator can be found. */
function collectBranches(node) {
  const branches = node.anyOf ?? node.oneOf
  if (!branches) return [node]
  return branches.flatMap((b) => (b.anyOf || b.oneOf ? collectBranches(b) : [b]))
}

/** The block union is discriminated on `type`, so when a value carries a `type`
 * we report only that branch's errors. Reporting all 22 branches would bury the
 * one that matters. */
function pickBranch(branches, value) {
  if (typeOf(value) !== 'object' || typeof value.type !== 'string') return null
  return branches.find((b) => b?.properties?.type?.const === value.type) ?? null
}

/**
 * @returns {{errors: {path: string, message: string}[], warnings: {path: string, message: string}[]}}
 */
export function validatePayload(value, schema) {
  const errors = []
  const warnings = []

  const walk = (node, val, path) => {
    const at = (msg) => errors.push({ path, message: msg })

    if (node.anyOf || node.oneOf) {
      const branches = collectBranches(node)
      const picked = pickBranch(branches, val)
      if (picked) return walk(picked, val, path)

      const discriminators = branches
        .map((b) => b?.properties?.type?.const)
        .filter((c) => typeof c === 'string')
      if (discriminators.length > 0 && typeOf(val) === 'object') {
        at(
          `Invalid discriminator value. Expected one of ${discriminators.join(', ')}, received ${
            typeof val.type === 'string' ? `'${val.type}'` : 'nothing'
          }`,
        )
        return
      }

      // Not a discriminated union: accept if any branch accepts, otherwise
      // report the branch that came closest.
      let best = null
      for (const branch of branches) {
        const attempt = validatePayload(val, branch)
        if (attempt.errors.length === 0) return
        if (!best || attempt.errors.length < best.errors.length) best = attempt
      }
      if (best) {
        for (const e of best.errors) errors.push({ path: joinPath(path, e.path), message: e.message })
        for (const w of best.warnings) warnings.push({ path: joinPath(path, w.path), message: w.message })
      }
      return
    }

    if (node.const !== undefined && val !== node.const) {
      at(`Invalid input: expected '${node.const}', received ${JSON.stringify(val)}`)
      return
    }

    if (node.enum && !node.enum.includes(val)) {
      at(`Invalid option: expected one of ${node.enum.join(', ')}, received ${JSON.stringify(val)}`)
      return
    }

    if (node.type && !matchesType(val, node.type)) {
      at(`Invalid input: expected ${node.type}, received ${typeOf(val)}`)
      return
    }

    if (node.type === 'string') {
      if (node.minLength !== undefined && val.length < node.minLength) {
        at(`Too small: expected string to have >=${node.minLength} characters`)
      }
      if (node.maxLength !== undefined && val.length > node.maxLength) {
        at(`Too big: expected string to have <=${node.maxLength} characters`)
      }
      return
    }

    if (node.type === 'number' || node.type === 'integer') {
      if (node.minimum !== undefined && val < node.minimum) {
        at(`Too small: expected number to be >=${node.minimum}`)
      }
      if (node.maximum !== undefined && val > node.maximum) {
        at(`Too big: expected number to be <=${node.maximum}`)
      }
      return
    }

    if (node.type === 'array') {
      if (node.minItems !== undefined && val.length < node.minItems) {
        at(`Too small: expected array to have >=${node.minItems} items`)
      }
      if (node.maxItems !== undefined && val.length > node.maxItems) {
        at(`Too big: expected array to have <=${node.maxItems} items`)
      }
      if (node.prefixItems) {
        node.prefixItems.forEach((item, i) => {
          if (i >= val.length) at(`Invalid input: expected ${item.type ?? 'value'} at index ${i}, received nothing`)
          else walk(item, val[i], `${path}.${i}`)
        })
        if (node.items === false && val.length > node.prefixItems.length) {
          at(`Too big: expected array to have <=${node.prefixItems.length} items`)
        }
        return
      }
      if (node.items) val.forEach((item, i) => walk(node.items, item, joinPath(path, i)))
      return
    }

    if (node.type === 'object') {
      for (const key of node.required ?? []) {
        if (val[key] === undefined) {
          const expected = node.properties?.[key]?.type ?? 'value'
          errors.push({
            path: joinPath(path, key),
            message: `Invalid input: expected ${expected}, received undefined`,
          })
        }
      }
      for (const [key, sub] of Object.entries(node.properties ?? {})) {
        if (val[key] !== undefined) walk(sub, val[key], joinPath(path, key))
      }
      // The API's Zod objects strip unknown keys rather than rejecting them,
      // so an invented field is a warning here, not an error: it will publish,
      // and it will never render.
      if (node.additionalProperties === false) {
        for (const key of Object.keys(val)) {
          if (!node.properties?.[key]) {
            warnings.push({
              path: joinPath(path, key),
              message: 'Unknown field. The API strips it; it will never render.',
            })
          }
        }
      }
    }
  }

  walk(schema, value, '')
  return { errors, warnings }
}

const LONG_PROSE_CHARS = 400
const LONG_CELL_CHARS = 200
const LONG_STAT_CHARS = 50
const PROSE_BLOCKS = new Set(['p', 'note', 'warn', 'good'])
/** Fields whose string is code, not text the reader reads as prose. */
const CODE_FIELDS = new Set(['code', 'before', 'after', 'latex'])
const URL_PATTERN = /\bhttps?:\/\/\S+/g
const PATH_PATTERN = /(?:~|\.{1,2}|[\w@.-]+)?(?:\/[\w@.-]+)+\/?/g
const MARKUP_PATTERN = /`|\*\*|\[[^\]]+\]\([^)]+\)/

/** Paths a reader would recognise as a location on disk. Slash-separated words
 * such as "and/or", "TCP/IP", or "dev/staging/prod", dates such as 14/10/2026,
 * and URLs written without a scheme are not paths, so a short token only
 * counts when its last part has a file extension. */
function isFilePath(token) {
  if (/^(?:~|\.{1,2})\//.test(token)) return true
  if (/^\/(?:home|mnt|etc|var|tmp|usr|opt|srv|root|Users)\//.test(token)) return true
  const parts = token.split('/').filter(Boolean)
  if (!parts.some((p) => /[A-Za-z]/.test(p))) return false
  if (parts.length >= 2 && /\.[A-Za-z]\w{0,4}$/.test(parts.at(-1))) return true
  const startsWithDomain = parts[0].includes('.')
  return !token.startsWith('/') && !startsWithDomain && parts.length >= 4
}

function proseHints(text, path, hints) {
  if (text.length > LONG_PROSE_CHARS) {
    hints.push({
      path,
      message: `${text.length} characters in one paragraph. Keep one point per paragraph: split it, or move the supporting detail into a table or a details block.`,
    })
  }
  const paths = (text.replace(URL_PATTERN, ' ').match(PATH_PATTERN) ?? []).filter(isFilePath)
  if (paths.length > 0) {
    hints.push({
      path,
      message: `File path in running text (${paths.join(', ')}). Say what the file does instead; if the reader needs the path, put it in a table, a code block's filename, or a details block.`,
    })
  }
}

function cellHints(rows, base, hints) {
  rows.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell.length > LONG_CELL_CHARS) {
        hints.push({
          path: `${base}.${r}.${c}`,
          message: `${cell.length} characters in one table cell. A cell holds a phrase; put the explanation in a paragraph or a details block.`,
        })
      }
    }),
  )
}

function statHints(items, base, hints) {
  items.forEach((item, k) => {
    for (const field of ['label', 'hint']) {
      if (item[field]?.length > LONG_STAT_CHARS) {
        hints.push({
          path: `${base}.${k}.${field}`,
          message: `${item[field].length} characters on a stat tile. A tile holds a number and a few words; put the qualifiers in the paragraph beside it.`,
        })
      }
    }
  })
}

/**
 * Readability checks the API does not enforce. Each hint names a pattern that
 * makes a document hard to read for someone who did not follow the work.
 * Expects a payload that already passed validatePayload.
 *
 * @returns {{path: string, message: string}[]}
 */
export function readabilityHints(payload) {
  const hints = []

  const visitBlocks = (blocks, base) => {
    blocks.forEach((block, i) => {
      const at = `${base}.${i}`
      if (PROSE_BLOCKS.has(block.type)) proseHints(block.text, `${at}.text`, hints)
      if (block.type === 'details') visitBlocks(block.blocks, `${at}.blocks`)
      if (block.type === 'table') cellHints(block.rows, `${at}.rows`, hints)
      if (block.type === 'stat') statHints(block.items, `${at}.items`, hints)
    })
  }
  payload.sections.forEach((section, i) => visitBlocks(section.blocks, `sections.${i}.blocks`))
  payload.decisions.forEach((decision, i) => {
    if (decision.why) proseHints(decision.why, `decisions.${i}.why`, hints)
    if (decision.cmp) cellHints(decision.cmp.rows, `decisions.${i}.cmp.rows`, hints)
    decision.opts.forEach((opt, k) => {
      if (opt.detail) proseHints(opt.detail, `decisions.${i}.opts.${k}.detail`, hints)
    })
  })

  const visitStrings = (node, path) => {
    if (typeof node === 'string') {
      if (MARKUP_PATTERN.test(node)) {
        hints.push({
          path,
          message: 'Brief renders text as typed, so this markdown shows as literal characters. Write names plainly and put code in a code block.',
        })
      }
    } else if (Array.isArray(node)) {
      node.forEach((item, i) => visitStrings(item, joinPath(path, i)))
    } else if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (!CODE_FIELDS.has(key)) visitStrings(value, joinPath(path, key))
      }
    }
  }
  visitStrings(payload, '')

  return hints
}

function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('usage: node validate.mjs <payload.json>')
    process.exit(2)
  }

  let body
  try {
    body = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    console.error(`Body is not valid JSON: ${e.message}`)
    process.exit(1)
  }

  const payload = body && typeof body === 'object' && body.payload ? body.payload : body
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'))
  const { errors, warnings } = validatePayload(payload, schema)

  const bytes = Buffer.byteLength(JSON.stringify(payload), 'utf8')
  if (bytes > MAX_PAYLOAD_BYTES) {
    errors.push({ path: '', message: `Payload exceeds ${MAX_PAYLOAD_BYTES} bytes (${bytes}).` })
  }

  for (const w of warnings) console.error(`warning  ${w.path}: ${w.message}`)

  if (errors.length > 0) {
    for (const e of errors) console.error(`${e.path || '(root)'}: ${e.message}`)
    console.error(`\n${errors.length} problem(s). The API would reject this payload with a 400.`)
    process.exit(1)
  }

  const hints = readabilityHints(payload)
  for (const h of hints) console.error(`hint     ${h.path}: ${h.message}`)

  console.log(
    `Valid. ${bytes} bytes, ${payload.sections.length} section(s), ${payload.decisions.length} decision(s), ${hints.length} readability hint(s).`,
  )
}

/** Compare real paths, not raw ones: a skill directory is often a symlink into
 * a dotfiles repo, and then import.meta.url (already resolved) never equals
 * argv[1] (not resolved). Getting this wrong makes the script exit 0 without
 * validating anything, which reads exactly like a pass. */
function isEntryPoint() {
  if (!process.argv[1]) return false
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
  } catch {
    return false
  }
}

if (isEntryPoint()) main()
