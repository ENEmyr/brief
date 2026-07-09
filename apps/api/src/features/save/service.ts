import { eq } from 'drizzle-orm'
import { sessions } from '../../db/schema'
import { db, SAVED_TTL_MS } from '../session/service'
import type { SaveBody } from './model'

export type SaveResult =
  | { ok: true; encrypted: boolean; expiresAt: number }
  | { ok: false; status: 404 | 409; error: string }

export async function saveSession(
  env: { DB: D1Database; KV: KVNamespace },
  id: string,
  body: SaveBody,
  now: number,
): Promise<SaveResult> {
  const row = await db(env.DB).select().from(sessions).where(eq(sessions.id, id)).get()
  if (!row || row.expiresAt <= now) return { ok: false, status: 404, error: 'Session not found or expired.' }
  const expiresAt = now + SAVED_TTL_MS
  if (body.mode === 'plain') {
    await db(env.DB).update(sessions).set({ saved: true, lastOpenedAt: now, expiresAt }).where(eq(sessions.id, id))
    await env.KV.delete(`payload:${id}`)
    return { ok: true, encrypted: row.encrypted, expiresAt }
  }
  if (row.encrypted) return { ok: false, status: 409, error: 'Session is already encrypted.' }
  await db(env.DB)
    .update(sessions)
    .set({
      saved: true,
      encrypted: true,
      payload: body.ciphertext,
      encParams: JSON.stringify(body.encParams),
      lastOpenedAt: now,
      expiresAt,
    })
    .where(eq(sessions.id, id))
  await env.KV.delete(`payload:${id}`)
  return { ok: true, encrypted: true, expiresAt }
}
