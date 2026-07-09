import { Elysia } from 'elysia'
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'
import { cors } from '@elysiajs/cors'
import type { AppEnv } from './env'

export function createApp(env: AppEnv) {
  return new Elysia({ adapter: CloudflareAdapter })
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
    .compile()
}
