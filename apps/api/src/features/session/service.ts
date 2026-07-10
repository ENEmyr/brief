import { eq, sql } from 'drizzle-orm'
import { customAlphabet } from 'nanoid'
import { sessions } from '../../db/schema'
import { db, UNSAVED_TTL_MS, touchWindow } from '../../shared/db'

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const newId = customAlphabet(alphabet, 14)

export async function createSession(d1: D1Database, payloadStr: string, title: string, now: number): Promise<{ id: string }> {
  const id = newId()
  await db(d1).insert(sessions).values({
    id,
    payload: payloadStr,
    title,
    saved: false,
    encrypted: false,
    encParams: null,
    createdAt: now,
    lastOpenedAt: now,
    expiresAt: now + UNSAVED_TTL_MS,
  })
  return { id }
}

export interface SessionRow {
  id: string
  payload: string
  title: string
  saved: boolean
  encrypted: boolean
  encParams: string | null
  createdAt: number
  lastOpenedAt: number
  expiresAt: number
}

export async function getSession(
  env: { DB: D1Database; KV: KVNamespace },
  id: string,
  now: number,
): Promise<SessionRow | null> {
  const cacheKey = `payload:${id}`
  const cached = await env.KV.get<SessionRow>(cacheKey, 'json')
  let row = cached
  if (!row) {
    const found = await db(env.DB).select().from(sessions).where(eq(sessions.id, id)).get()
    row = found ?? null
  }
  if (!row) return null
  if (row.expiresAt <= now) {
    await db(env.DB).delete(sessions).where(eq(sessions.id, id))
    await env.KV.delete(cacheKey)
    return null
  }
  // Sliding-window bump. On a KV cache hit both row.saved and row.expiresAt can be stale
  // (e.g. a concurrent PUT /save already wrote a 90d expiry to D1), so the MAX must be
  // computed by D1 against the live row, not in JS against the cached copy. RETURNING
  // hands back the value D1 actually kept so the response and KV never understate it.
  const candidate = now + touchWindow(row.saved)
  const bumped = await db(env.DB)
    .update(sessions)
    .set({ lastOpenedAt: now, expiresAt: sql`MAX(expires_at, ${candidate})` })
    .where(eq(sessions.id, id))
    .returning({ expiresAt: sessions.expiresAt })
  const expiresAt = bumped[0]?.expiresAt ?? candidate
  const fresh: SessionRow = { ...row, lastOpenedAt: now, expiresAt }
  await env.KV.put(cacheKey, JSON.stringify(fresh), { expirationTtl: 3600 })
  return fresh
}
