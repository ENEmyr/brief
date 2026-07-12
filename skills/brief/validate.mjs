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

  console.log(`Valid. ${bytes} bytes, ${payload.sections.length} section(s), ${payload.decisions.length} decision(s).`)
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
