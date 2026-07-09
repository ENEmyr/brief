import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { customAlphabet } from 'nanoid'
import { sessions } from '../../db/schema'
import { DAY_MS } from '../../shared/time'

export const UNSAVED_TTL_MS = 7 * DAY_MS
export const SAVED_TTL_MS = 90 * DAY_MS

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const newId = customAlphabet(alphabet, 14)

export function db(d1: D1Database): DrizzleD1Database {
  return drizzle(d1)
}

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

export function touchWindow(saved: boolean): number {
  return saved ? SAVED_TTL_MS : UNSAVED_TTL_MS
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
  const expiresAt = Math.max(row.expiresAt, now + touchWindow(row.saved))
  await db(env.DB).update(sessions).set({ lastOpenedAt: now, expiresAt }).where(eq(sessions.id, id))
  const fresh: SessionRow = { ...row, lastOpenedAt: now, expiresAt }
  await env.KV.put(cacheKey, JSON.stringify(fresh), { expirationTtl: 3600 })
  return fresh
}
