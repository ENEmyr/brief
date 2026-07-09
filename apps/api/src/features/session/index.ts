import { Elysia } from 'elysia'
import type { AppEnv } from '../../env'
import { MAX_PAYLOAD_BYTES } from '@brief/schema'
import { createSessionBody } from './model'
import { createSession, getSession } from './service'

export function sessionFeature(env: AppEnv) {
  return new Elysia({ name: 'session' })
    .post('/api/session', async ({ request, set }) => {
      if (env.RATE_LIMITER) {
        const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
        const { success } = await env.RATE_LIMITER.limit({ key: `create:${ip}` })
        if (!success) {
          set.status = 429
          return { error: 'Rate limit exceeded. Try again in a minute.' }
        }
      }
      const raw = await request.text()
      const rawBytes = new TextEncoder().encode(raw).byteLength
      if (rawBytes > MAX_PAYLOAD_BYTES + 65_536) {
        set.status = 413
        return { error: `Payload exceeds ${MAX_PAYLOAD_BYTES} bytes.` }
      }
      let body: unknown
      try {
        body = JSON.parse(raw)
      } catch {
        set.status = 400
        return { error: 'Body is not valid JSON.' }
      }
      const parsed = createSessionBody.safeParse(body)
      if (!parsed.success) {
        set.status = 400
        return { error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).slice(0, 10).join('; ') }
      }
      const payloadStr = JSON.stringify(parsed.data.payload)
      const payloadBytes = new TextEncoder().encode(payloadStr).byteLength
      if (payloadBytes > MAX_PAYLOAD_BYTES) {
        set.status = 413
        return { error: `Payload exceeds ${MAX_PAYLOAD_BYTES} bytes.` }
      }
      const { id } = await createSession(env.DB, payloadStr, parsed.data.payload.meta.title, Date.now())
      set.status = 201
      return { id, url: `${env.PUBLIC_WEB_ORIGIN}/s/${id}` }
    })
    .get('/api/session/:id', async ({ params, set }) => {
      const row = await getSession(env, params.id, Date.now())
      if (!row) {
        set.status = 404
        return { error: 'Session not found or expired.' }
      }
      return {
        id: row.id,
        payload: row.payload,
        title: row.title,
        saved: row.saved,
        encrypted: row.encrypted,
        encParams: row.encParams ? JSON.parse(row.encParams) : null,
        createdAt: row.createdAt,
        lastOpenedAt: row.lastOpenedAt,
        expiresAt: row.expiresAt,
      }
    })
}
