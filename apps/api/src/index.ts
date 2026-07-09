import { env } from 'cloudflare:workers'
import { createApp } from './app'
import type { AppEnv } from './env'

const app = createApp(env as unknown as AppEnv)

export default {
  fetch: (request: Request) => app.handle(request),
  // scheduled purge wired in the cron task
}
