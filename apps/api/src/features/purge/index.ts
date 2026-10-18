import { lte } from 'drizzle-orm'
import { sessions } from '../../db/schema'
import { db } from '../../shared/db'
import { purgeImages } from '../image'

export async function purgeExpired(
  env: { DB: D1Database; IMAGES: R2Bucket },
  now: number,
): Promise<{ sessions: number; images: number }> {
  const images = await purgeImages(env, now)
  const result = await db(env.DB).delete(sessions).where(lte(sessions.expiresAt, now))
  return { sessions: result.meta.changes, images }
}
