import { env } from 'cloudflare:workers'
import { createApp } from './app'
import { purgeExpired } from './features/purge'
import type { AppEnv } from './env'

const appEnv = env as unknown as AppEnv
const app = createApp(appEnv)

export default {
  fetch: (request: Request) => app.handle(request),
  scheduled: async () => {
    const purged = await purgeExpired(appEnv, Date.now())
    console.log(JSON.stringify({ event: 'purge', purged, at: new Date().toISOString() }))
  },
}
