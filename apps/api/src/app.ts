import { Elysia } from 'elysia'
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'
import { cors } from '@elysiajs/cors'
import type { AppEnv } from './env'
import { sessionFeature } from './features/session'

export function createApp(env: AppEnv) {
  return new Elysia({ adapter: CloudflareAdapter })
    .onError(({ code, set }) => {
      if (code === 'NOT_FOUND') return
      set.status = 500
      return { error: 'Internal error.' }
    })
    .use(
      cors({
        origin: (request): boolean => {
          const origin = request.headers.get('origin')
          if (!origin) return false
          if (origin === env.PUBLIC_WEB_ORIGIN) return true
          if (origin.endsWith('.brief-web.pages.dev')) return true
          if (origin.startsWith('http://localhost:')) return true
          return false
        },
        methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
      }),
    )
    .get('/health', () => ({ ok: true }))
    .use(sessionFeature(env))
    .compile()
}
