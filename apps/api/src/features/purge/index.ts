import { lte } from 'drizzle-orm'
import { sessions } from '../../db/schema'
import { db } from '../session/service'

export async function purgeExpired(env: { DB: D1Database }, now: number): Promise<number> {
  const result = await db(env.DB).delete(sessions).where(lte(sessions.expiresAt, now))
  return result.meta.changes
}
