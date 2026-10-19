import { and, count, eq, gt, inArray, isNull, or } from 'drizzle-orm'
import { customAlphabet } from 'nanoid'
import type { Payload } from '@brief/schema'
import { images, sessions } from '../../db/schema'
import { db } from '../../shared/db'
import { ENCRYPTED_CONTENT_TYPE, MAX_IMAGES_PER_SESSION, ORPHAN_WINDOW_MS } from './model'

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const newImageId = (): string => `img_${customAlphabet(alphabet, 16)()}`

// D1 caps bound parameters per statement at 100; R2 delete takes up to 1000 keys.
const CHUNK = 90

const KEY_PREFIX = 'images/'
export const imageKey = (id: string): string => `${KEY_PREFIX}${id}`

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
  // Plaintext copies stay linked until the client finishes its encrypt flow, so only
  // encrypted rows count toward this route's cap.
  const stored = await db(env.DB)
    .select({ n: count() })
    .from(images)
    .where(and(eq(images.sessionId, sessionId), eq(images.encrypted, true)))
    .get()
  if ((stored?.n ?? 0) >= MAX_IMAGES_PER_SESSION) {
    return { ok: false, status: 409, error: `A session holds at most ${MAX_IMAGES_PER_SESSION} encrypted images.` }
  }
  const imageId = await storeImage(env, bytes, { contentType: ENCRYPTED_CONTENT_TYPE, encrypted: true, sessionId }, now)
  return { ok: true, imageId }
}

export type UnlinkResult = { ok: true } | { ok: false; status: 404 | 409; error: string }

// Removes an encrypted copy a failed or cancelled archive left behind. The row goes first, in
// one statement that also checks the session is still unencrypted: the server cannot read an
// encrypted payload, and only an encrypt-save can make one name a copy, so an encrypt-save that
// commits first always wins and a copy it references is never deleted.
export async function deleteEncryptedImage(env: ImageEnv, sessionId: string, imageId: string): Promise<UnlinkResult> {
  const deleted = await env.DB.prepare(
    `DELETE FROM images WHERE id = ?1 AND session_id = ?2 AND encrypted = 1
       AND EXISTS (SELECT 1 FROM sessions WHERE id = ?2 AND encrypted = 0)
     RETURNING content_type, byte_size, created_at`,
  )
    .bind(imageId, sessionId)
    .first<{ content_type: string; byte_size: number; created_at: number }>()
  if (!deleted) {
    const owned = await db(env.DB)
      .select({ id: images.id })
      .from(images)
      .where(and(eq(images.id, imageId), eq(images.sessionId, sessionId), eq(images.encrypted, true)))
      .get()
    return owned
      ? { ok: false, status: 409, error: 'Image belongs to the saved archive.' }
      : { ok: false, status: 404, error: 'Image not found.' }
  }
  try {
    await env.IMAGES.delete(imageKey(imageId))
  } catch (error) {
    // Put the row back so purge still finds the object with its session.
    await db(env.DB).insert(images).values({
      id: imageId,
      sessionId,
      contentType: deleted.content_type,
      encrypted: true,
      byteSize: deleted.byte_size,
      createdAt: deleted.created_at,
    })
    throw error
  }
  return { ok: true }
}

// Runs after an encrypt-save committed: the client has uploaded encrypted copies and the new
// payload names only those, so the plaintext copies must not outlive the encryption. Objects go
// before rows, as in purgeImages, so a failed R2 call never leaves an object without its row.
export async function deletePlainImages(env: ImageEnv, sessionId: string): Promise<void> {
  const rows = await db(env.DB)
    .select({ id: images.id })
    .from(images)
    .where(and(eq(images.sessionId, sessionId), eq(images.encrypted, false)))
    .all()
  for (let i = 0; i < rows.length; i += CHUNK) {
    const ids = rows.slice(i, i + CHUNK).map((r) => r.id)
    await env.IMAGES.delete(ids.map(imageKey))
    await db(env.DB).delete(images).where(inArray(images.id, ids))
  }
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
    // A plaintext copy left behind by a failed deletePlainImages must still never serve once
    // its session is encrypted.
    .where(and(eq(images.id, id), or(eq(images.encrypted, true), eq(sessions.encrypted, false))))
    .get()
  if (!row || row.expiresAt <= now) return null
  const object = await env.IMAGES.get(imageKey(id))
  if (!object) return null
  return { body: object.body, contentType: row.contentType, byteSize: row.byteSize, expiresAt: row.expiresAt }
}

// Images whose session expired or is already gone (getSession and saveSession delete expired
// rows lazily), orphans never linked inside the window, and plaintext copies a failed
// deletePlainImages left on an encrypted session. Objects go before rows so a failed R2 call
// leaves the rows for the next run to retry. Then objects with no row at all, which a worker
// that died between deleteEncryptedImage's row delete and its restore leaves behind.
export async function purgeImages(env: ImageEnv, now: number): Promise<number> {
  let purged = 0
  for (;;) {
    const { results } = await env.DB.prepare(
      `SELECT i.id FROM images i LEFT JOIN sessions s ON s.id = i.session_id
       WHERE (i.session_id IS NULL AND i.created_at <= ?1)
          OR (i.session_id IS NOT NULL AND (s.id IS NULL OR s.expires_at <= ?2 OR (s.encrypted = 1 AND i.encrypted = 0)))
       LIMIT ${CHUNK}`,
    )
      .bind(now - ORPHAN_WINDOW_MS, now)
      .all<{ id: string }>()
    if (results.length === 0) break
    const ids = results.map((r) => r.id)
    await env.IMAGES.delete(ids.map(imageKey))
    await db(env.DB).delete(images).where(inArray(images.id, ids))
    purged += ids.length
  }
  // A failed sweep must not stop purgeExpired from deleting expired sessions; the next run retries.
  // shortcut: lists every object on each run; keep a stray-key log instead if the bucket grows
  // past a few thousand objects.
  try {
    let cursor: string | undefined
    do {
      const page = await env.IMAGES.list({ prefix: KEY_PREFIX, cursor })
      const old = page.objects
        .filter((object) => object.uploaded.getTime() <= now - ORPHAN_WINDOW_MS)
        .map((object) => object.key.slice(KEY_PREFIX.length))
      for (let i = 0; i < old.length; i += CHUNK) {
        const ids = old.slice(i, i + CHUNK)
        const rows = await db(env.DB).select({ id: images.id }).from(images).where(inArray(images.id, ids)).all()
        const rowed = new Set(rows.map((r) => r.id))
        const stray = ids.filter((id) => !rowed.has(id))
        if (stray.length > 0) await env.IMAGES.delete(stray.map(imageKey))
        purged += stray.length
      }
      cursor = page.truncated ? page.cursor : undefined
    } while (cursor)
  } catch (error) {
    console.error(
      JSON.stringify({ event: 'stray_image_sweep_error', error: error instanceof Error ? error.name : 'unknown', at: new Date(now).toISOString() }),
    )
  }
  return purged
}
