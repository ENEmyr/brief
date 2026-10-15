import { and, count, eq, gt, inArray, isNull } from 'drizzle-orm'
import { customAlphabet } from 'nanoid'
import type { Payload } from '@brief/schema'
import { images, sessions } from '../../db/schema'
import { db } from '../../shared/db'
import { ENCRYPTED_CONTENT_TYPE, MAX_IMAGES_PER_SESSION, ORPHAN_WINDOW_MS } from './model'

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const newImageId = (): string => `img_${customAlphabet(alphabet, 16)()}`

// D1 caps bound parameters per statement at 100; R2 delete takes up to 1000 keys.
const CHUNK = 90

export const imageKey = (id: string): string => `images/${id}`

type ImageEnv = { DB: D1Database; IMAGES: R2Bucket }

async function storeImage(
  env: ImageEnv,
  bytes: Uint8Array,
  row: { contentType: string; encrypted: boolean; sessionId: string | null },
  now: number,
): Promise<string> {
  const id = newImageId()
  // Row first: purge is row-driven, so an object written without its row could never be found.
  await db(env.DB).insert(images).values({ id, ...row, byteSize: bytes.byteLength, createdAt: now })
  try {
    await env.IMAGES.put(imageKey(id), bytes, { httpMetadata: { contentType: row.contentType } })
  } catch (error) {
    await db(env.DB).delete(images).where(eq(images.id, id))
    throw error
  }
  return id
}

export function storePlainImage(env: ImageEnv, bytes: Uint8Array, contentType: string, now: number): Promise<string> {
  return storeImage(env, bytes, { contentType, encrypted: false, sessionId: null }, now)
}

export type EncryptedUploadResult =
  | { ok: true; imageId: string }
  | { ok: false; status: 404 | 409; error: string }

export async function storeEncryptedImage(
  env: ImageEnv,
  sessionId: string,
  bytes: Uint8Array,
  now: number,
): Promise<EncryptedUploadResult> {
  const session = await db(env.DB)
    .select({ expiresAt: sessions.expiresAt, encrypted: sessions.encrypted })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get()
  if (!session || session.expiresAt <= now) return { ok: false, status: 404, error: 'Session not found or expired.' }
  if (session.encrypted) return { ok: false, status: 409, error: 'Session is already encrypted.' }
  const linked = await db(env.DB).select({ n: count() }).from(images).where(eq(images.sessionId, sessionId)).get()
  if ((linked?.n ?? 0) >= MAX_IMAGES_PER_SESSION) {
    return { ok: false, status: 409, error: `A session holds at most ${MAX_IMAGES_PER_SESSION} images.` }
  }
  const imageId = await storeImage(env, bytes, { contentType: ENCRYPTED_CONTENT_TYPE, encrypted: true, sessionId }, now)
  return { ok: true, imageId }
}

export function imageIdsIn(payload: Payload): string[] {
  const ids = new Set<string>()
  for (const section of payload.sections) {
    for (const block of section.blocks) {
      const nested = block.type === 'details' ? block.blocks : [block]
      for (const inner of nested) if (inner.type === 'image') ids.add(inner.imageId)
    }
  }
  return [...ids]
}

// Ids that are unknown, already linked, encrypted or past the orphan window are left alone,
// so a payload that names them still saves; the reader shows its missing-image state.
export async function linkImages(d1: D1Database, sessionId: string, imageIds: string[], now: number): Promise<void> {
  const ids = imageIds.slice(0, MAX_IMAGES_PER_SESSION)
  for (let i = 0; i < ids.length; i += CHUNK) {
    await db(d1)
      .update(images)
      .set({ sessionId })
      .where(
        and(
          inArray(images.id, ids.slice(i, i + CHUNK)),
          isNull(images.sessionId),
          eq(images.encrypted, false),
          gt(images.createdAt, now - ORPHAN_WINDOW_MS),
        ),
      )
  }
}

export interface ServableImage {
  body: ReadableStream
  contentType: string
  byteSize: number
  expiresAt: number
}

export async function getServableImage(env: ImageEnv, id: string, now: number): Promise<ServableImage | null> {
  const row = await db(env.DB)
    .select({ contentType: images.contentType, byteSize: images.byteSize, expiresAt: sessions.expiresAt })
    .from(images)
    .innerJoin(sessions, eq(sessions.id, images.sessionId))
    .where(eq(images.id, id))
    .get()
  if (!row || row.expiresAt <= now) return null
  const object = await env.IMAGES.get(imageKey(id))
  if (!object) return null
  return { body: object.body, contentType: row.contentType, byteSize: row.byteSize, expiresAt: row.expiresAt }
}

// Images whose session expired or is already gone (getSession and saveSession delete expired
// rows lazily), plus orphans never linked inside the window. Objects go before rows so a
// failed R2 call leaves the rows for the next run to retry.
export async function purgeImages(env: ImageEnv, now: number): Promise<number> {
  let purged = 0
  for (;;) {
    const { results } = await env.DB.prepare(
      `SELECT i.id FROM images i LEFT JOIN sessions s ON s.id = i.session_id
       WHERE (i.session_id IS NULL AND i.created_at <= ?1)
          OR (i.session_id IS NOT NULL AND (s.id IS NULL OR s.expires_at <= ?2))
       LIMIT ${CHUNK}`,
    )
      .bind(now - ORPHAN_WINDOW_MS, now)
      .all<{ id: string }>()
    if (results.length === 0) return purged
    const ids = results.map((r) => r.id)
    await env.IMAGES.delete(ids.map(imageKey))
    await db(env.DB).delete(images).where(inArray(images.id, ids))
    purged += ids.length
  }
}
