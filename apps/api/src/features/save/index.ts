import { Elysia } from 'elysia'
import type { AppEnv } from '../../env'
import { saveBody } from './model'
import { CIPHERTEXT_TOO_LARGE_MESSAGE, saveSession } from './service'

const MAX_SAVE_BODY_BYTES = 2_700_000

export function saveFeature(env: AppEnv) {
  return new Elysia({ name: 'save' }).put('/api/session/:id/save', async ({ params, request, set }) => {
    if (env.RATE_LIMITER) {
      const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
      const { success } = await env.RATE_LIMITER.limit({ key: `save:${ip}` })
      if (!success) {
        set.status = 429
        return { error: 'Rate limit exceeded. Try again in a minute.' }
      }
    }
    const raw = await request.text()
    const rawBytes = new TextEncoder().encode(raw).byteLength
    if (rawBytes > MAX_SAVE_BODY_BYTES) {
      set.status = 413
      return { error: `Payload exceeds ${MAX_SAVE_BODY_BYTES} bytes.` }
    }
    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      set.status = 400
      return { error: 'Body is not valid JSON.' }
    }
    const parsed = saveBody.safeParse(body)
    if (!parsed.success) {
      const ciphertextTooBig = parsed.error.issues.some(
        (i) => i.code === 'too_big' && i.path.join('.') === 'ciphertext',
      )
      if (ciphertextTooBig) {
        set.status = 413
        return { error: CIPHERTEXT_TOO_LARGE_MESSAGE }
      }
      set.status = 400
      return { error: 'Invalid save request.' }
    }
    const result = await saveSession(env, params.id, parsed.data, Date.now())
    if (!result.ok) {
      set.status = result.status
      return { error: result.error }
    }
    return { saved: true, encrypted: result.encrypted, expiresAt: result.expiresAt }
  })
}
