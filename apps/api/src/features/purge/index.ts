import { lte } from 'drizzle-orm'
import { sessions } from '../../db/schema'
import { db } from '../../shared/db'
import { purgeImages } from '../image'

// Workers Free allows 1,000 calls to R2, D1 and KV per run; the margin covers the per-key fallback.
export const PURGE_CALL_BUDGET = 800

export async function purgeExpired(
  env: { DB: D1Database; IMAGES: R2Bucket },
  now: number,
  budget = PURGE_CALL_BUDGET,
): Promise<{ sessions: number; images: number }> {
  // Sessions first, so a run cut off by the budget still deletes them; their images are then
  // found as images of a vanished session.
  const result = await db(env.DB).delete(sessions).where(lte(sessions.expiresAt, now))
  const images = await purgeImages(env, now, budget - 1)
  return { sessions: result.meta.changes, images }
}
