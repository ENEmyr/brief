import { Elysia } from 'elysia'
import type { AppEnv } from '../../env'
import { saveBody } from './model'
import { saveSession } from './service'

export function saveFeature(env: AppEnv) {
  return new Elysia({ name: 'save' }).put('/api/session/:id/save', async ({ params, request, set }) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      set.status = 400
      return { error: 'Body is not valid JSON.' }
    }
    const parsed = saveBody.safeParse(body)
    if (!parsed.success) {
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
