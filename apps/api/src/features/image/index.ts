import { Elysia } from 'elysia'
import { IMAGE_ID_PATTERN } from '@brief/schema'
import type { AppEnv } from '../../env'
import { ENCRYPTED_CONTENT_TYPE, MAX_ENCRYPTED_IMAGE_BYTES, MAX_IMAGE_BYTES, sniffImageType } from './model'
import { getServableImage, storeEncryptedImage, storePlainImage } from './service'

export { imageIdsIn, linkImages, purgeImages } from './service'

type ReadResult = { ok: true; bytes: Uint8Array } | { ok: false; status: 400 | 413; error: string }

async function readBody(request: Request, cap: number): Promise<ReadResult> {
  const tooLarge = { ok: false, status: 413, error: `Image exceeds ${cap} bytes.` } as const
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > cap) return tooLarge
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength > cap) return tooLarge
  if (bytes.byteLength === 0) return { ok: false, status: 400, error: 'Image body is empty.' }
  return { ok: true, bytes }
}

export function imageFeature(env: AppEnv) {
  const limited = async (request: Request): Promise<boolean> => {
    if (!env.RATE_LIMITER) return false
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
    const { success } = await env.RATE_LIMITER.limit({ key: `image:${ip}` })
    return !success
  }
  const rateLimited = { error: 'Rate limit exceeded. Try again in a minute.' }

  return new Elysia({ name: 'image' })
    .post('/api/image', async ({ request, set }) => {
      if (await limited(request)) {
        set.status = 429
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
      set.headers['cache-control'] = `private, max-age=${Math.floor((image.expiresAt - now) / 1000)}`
      set.headers['content-disposition'] = encrypted ? 'attachment' : 'inline'
      return new Response(image.body)
    })
}
