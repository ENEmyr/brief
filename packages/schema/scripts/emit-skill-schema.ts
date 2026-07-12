/** Emits skills/brief/payload.schema.json from payloadSchema, so the brief
 * skill's offline validator reads generated rules rather than a hand-written
 * copy of the schema. skill-validator.test.ts fails when the committed file
 * drifts from this output; regenerate with `bun run gen:skill-schema`. */
import { z } from 'zod'
import fs from 'node:fs'
import path from 'node:path'
import { payloadSchema } from '../src/payload'

export const SKILL_SCHEMA_PATH = path.resolve(
  import.meta.dirname,
  '../../../skills/brief/payload.schema.json',
)

export function emitSkillSchema(): string {
  return JSON.stringify(z.toJSONSchema(payloadSchema), null, 2) + '\n'
}

if (import.meta.main) {
  fs.writeFileSync(SKILL_SCHEMA_PATH, emitSkillSchema())
  console.log(`wrote ${SKILL_SCHEMA_PATH}`)
}
