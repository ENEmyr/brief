import { Elysia } from 'elysia'
import { eq } from 'drizzle-orm'
import type { AppEnv } from '../../env'
import { sessions } from '../../db/schema'
import { db } from '../../shared/db'
import { stateBody } from './model'
import { DAY_MS } from '../../shared/time'

// 262_144-char zod cap can be ~3 bytes/char for Thai/CJK plaintext, plus JSON envelope
const MAX_STATE_BODY_BYTES = 800_000

export function stateFeature(env: AppEnv) {
  return new Elysia({ name: 'state' })
    .get('/api/session/:id/state', async ({ params }) => {
      const state = await env.KV.get(`state:${params.id}`)
      return { state }
    })
    .put('/api/session/:id/state', async ({ params, request, set }) => {
      if (env.RATE_LIMITER) {
        const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
        const { success } = await env.RATE_LIMITER.limit({ key: `state:${ip}` })
        if (!success) {
          set.status = 429
          return { error: 'Rate limit exceeded. Try again in a minute.' }
        }
      }
      const raw = await request.text()
      const rawBytes = new TextEncoder().encode(raw).byteLength
      if (rawBytes > MAX_STATE_BODY_BYTES) {
        set.status = 413
        return { error: `Payload exceeds ${MAX_STATE_BODY_BYTES} bytes.` }
      }
      let body: unknown
      try {
        body = JSON.parse(raw)
      } catch {
        set.status = 400
        return { error: 'Body is not valid JSON.' }
      }
      const parsed = stateBody.safeParse(body)
      if (!parsed.success) {
        set.status = 400
        return { error: 'Invalid state blob.' }
      }
      const exists = await db(env.DB)
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.id, params.id))
        .get()
      if (!exists) {
        set.status = 404
        return { error: 'Session not found.' }
      }
      await env.KV.put(`state:${params.id}`, parsed.data.state, { expirationTtl: (90 * DAY_MS) / 1000 })
      set.status = 204
      return null
    })
}
