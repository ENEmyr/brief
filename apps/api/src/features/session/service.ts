import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import { customAlphabet } from 'nanoid'
import type { Payload } from '@brief/schema'
import { sessions } from '../../db/schema'
import { DAY_MS } from '../../shared/time'

export const UNSAVED_TTL_MS = 7 * DAY_MS
export const SAVED_TTL_MS = 90 * DAY_MS

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const newId = customAlphabet(alphabet, 14)

export function db(d1: D1Database): DrizzleD1Database {
  return drizzle(d1)
}

export async function createSession(d1: D1Database, payload: Payload, now: number): Promise<{ id: string }> {
  const id = newId()
  await db(d1).insert(sessions).values({
    id,
    payload: JSON.stringify(payload),
    title: payload.meta.title,
    saved: false,
    encrypted: false,
    encParams: null,
    createdAt: now,
    lastOpenedAt: now,
    expiresAt: now + UNSAVED_TTL_MS,
  })
  return { id }
}
