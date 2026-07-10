import { and, eq } from 'drizzle-orm'
import { sessions } from '../../db/schema'
import { db, SAVED_TTL_MS } from '../../shared/db'
import type { SaveBody } from './model'

// Keep in sync with the zod ciphertext cap in ./model.ts. D1's row/value size ceiling is
// ~2MB; base64 ciphertext inflates ~33% over the plaintext it came from, so the effective
// cap must sit comfortably under that ceiling, not at it.
export const MAX_CIPHERTEXT_BYTES = 1_950_000

// Accepted phase-1 product limitation: docs whose ciphertext would not fit under D1's
// real row-size ceiling simply cannot be encrypted. Shared between the zod-rejection path
// in the route and the byte-length pre-write check below so both surfaces speak the same
// language to the client.
export const CIPHERTEXT_TOO_LARGE_MESSAGE =
  'Encrypted payload too large to store. Docs over ~1.4 MB cannot be protected in this version.'

export type SaveResult =
  | { ok: true; encrypted: boolean; expiresAt: number }
  | { ok: false; status: 404 | 409 | 413; error: string }

export async function saveSession(
  env: { DB: D1Database; KV: KVNamespace },
  id: string,
  body: SaveBody,
  now: number,
): Promise<SaveResult> {
  const row = await db(env.DB).select().from(sessions).where(eq(sessions.id, id)).get()
  if (!row) return { ok: false, status: 404, error: 'Session not found or expired.' }
  if (row.expiresAt <= now) {
    await db(env.DB).delete(sessions).where(eq(sessions.id, id))
    await env.KV.delete(`payload:${id}`)
    return { ok: false, status: 404, error: 'Session not found or expired.' }
  }
  const expiresAt = now + SAVED_TTL_MS
  if (body.mode === 'plain') {
    await db(env.DB).update(sessions).set({ saved: true, lastOpenedAt: now, expiresAt }).where(eq(sessions.id, id))
    await env.KV.delete(`payload:${id}`)
    return { ok: true, encrypted: row.encrypted, expiresAt }
  }
  const ciphertextBytes = new TextEncoder().encode(body.ciphertext).byteLength
  if (ciphertextBytes > MAX_CIPHERTEXT_BYTES) {
    return { ok: false, status: 413, error: CIPHERTEXT_TOO_LARGE_MESSAGE }
  }
  const result = await db(env.DB)
    .update(sessions)
    .set({
      saved: true,
      encrypted: true,
      payload: body.ciphertext,
      // Zero-knowledge: the title is Payload content, not metadata. Once a session is
      // encrypted the server must not retain a readable copy of it alongside the ciphertext.
      title: '',
      encParams: JSON.stringify(body.encParams),
      lastOpenedAt: now,
      expiresAt,
    })
    .where(and(eq(sessions.id, id), eq(sessions.encrypted, false)))
  if (result.meta.changes === 0) return { ok: false, status: 409, error: 'Session is already encrypted.' }
  await env.KV.delete(`payload:${id}`)
  return { ok: true, encrypted: true, expiresAt }
}
