import { Elysia } from 'elysia'
import { IMAGE_ID_PATTERN } from '@brief/schema'
import type { AppEnv } from '../../env'
import { ENCRYPTED_CONTENT_TYPE, MAX_ENCRYPTED_IMAGE_BYTES, MAX_IMAGE_BYTES, sniffImageType } from './model'
import { deleteEncryptedImage, getServableImage, storeEncryptedImage, storePlainImage } from './service'

export { deletePlainImages, imageIdsIn, linkImages, purgeImages } from './service'

// The limiter binding's period (wrangler.jsonc): the encrypted archive waits this long and
// resumes at the refused image instead of failing.
const RETRY_AFTER_SECONDS = '60'

type ReadResult = { ok: true; bytes: Uint8Array } | { ok: false; status: 400 | 413; error: string }

// Counts while reading, so a chunked body with no Content-Length stops at the cap instead
// of being buffered whole.
async function readBody(request: Request, cap: number): Promise<ReadResult> {
  const tooLarge = { ok: false, status: 413, error: `Image exceeds ${cap} bytes.` } as const
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > cap) return tooLarge
  const chunks: Uint8Array[] = []
  let total = 0
  const reader = request.body?.getReader()
  while (reader) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > cap) {
      await reader.cancel()
      return tooLarge
    }
    chunks.push(value)
  }
  if (total === 0) return { ok: false, status: 400, error: 'Image body is empty.' }
  const bytes = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) {
    bytes.set(chunk, at)
    at += chunk.byteLength
  }
  return { ok: true, bytes }
}

export function imageFeature(env: AppEnv) {
  // Deletes take their own key, so cleaning up a failed archive never spends the upload budget
  // its Retry needs.
  const limited = async (request: Request, prefix = 'image'): Promise<boolean> => {
    if (!env.RATE_LIMITER) return false
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
    const { success } = await env.RATE_LIMITER.limit({ key: `${prefix}:${ip}` })
    return !success
  }
  const rateLimited = { error: 'Rate limit exceeded. Try again in a minute.' }

  return new Elysia({ name: 'image' })
    .post('/api/image', async ({ request, set }) => {
      if (await limited(request)) {
        set.status = 429
        set.headers['retry-after'] = RETRY_AFTER_SECONDS
        return rateLimited
      }
      const read = await readBody(request, MAX_IMAGE_BYTES)
      if (!read.ok) {
        set.status = read.status
        return { error: read.error }
      }
      const contentType = sniffImageType(read.bytes)
      if (!contentType) {
        set.status = 415
        return { error: 'Unsupported image type. Upload PNG, JPEG, WebP or GIF.' }
      }
      const imageId = await storePlainImage(env, read.bytes, contentType, Date.now())
      set.status = 201
      return { imageId, contentType, bytes: read.bytes.byteLength }
    })
    .post('/api/session/:id/image', async ({ params, request, set }) => {
      if (await limited(request)) {
        set.status = 429
        set.headers['retry-after'] = RETRY_AFTER_SECONDS
        return rateLimited
      }
      const read = await readBody(request, MAX_ENCRYPTED_IMAGE_BYTES)
      if (!read.ok) {
        set.status = read.status
        return { error: read.error }
      }
      const result = await storeEncryptedImage(env, params.id, read.bytes, Date.now())
      if (!result.ok) {
        set.status = result.status
        return { error: result.error }
      }
      set.status = 201
      return { imageId: result.imageId, contentType: ENCRYPTED_CONTENT_TYPE, bytes: read.bytes.byteLength }
    })
    .delete('/api/session/:id/image/:imageId', async ({ params, request, set }) => {
      if (await limited(request, 'image-delete')) {
        set.status = 429
        set.headers['retry-after'] = RETRY_AFTER_SECONDS
        return rateLimited
      }
      const result = IMAGE_ID_PATTERN.test(params.imageId)
        ? await deleteEncryptedImage(env, params.id, params.imageId)
        : ({ ok: false, status: 404, error: 'Image not found.' } as const)
      if (!result.ok) {
        set.status = result.status
        return { error: result.error }
      }
      set.status = 204
      return null
    })
    .get('/api/image/:imageId', async ({ params, set }) => {
      const now = Date.now()
      const image = IMAGE_ID_PATTERN.test(params.imageId) ? await getServableImage(env, params.imageId, now) : null
      if (!image) {
        set.status = 404
        return { error: 'Image not found or expired.' }
      }
      const encrypted = image.contentType === ENCRYPTED_CONTENT_TYPE
      set.headers['content-type'] = image.contentType
      set.headers['content-length'] = String(image.byteSize)
      set.headers['x-content-type-options'] = 'nosniff'
      set.headers['content-security-policy'] = "default-src 'none'; sandbox"
      set.headers['cross-origin-resource-policy'] = 'cross-origin'
      // A cached plaintext copy would outlive a later encrypt; ciphertext is safe to keep.
      set.headers['cache-control'] = encrypted ? `private, max-age=${Math.floor((image.expiresAt - now) / 1000)}` : 'no-store'
      set.headers['content-disposition'] = encrypted ? 'attachment' : 'inline'
      return new Response(image.body)
    })
}
