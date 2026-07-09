import type { D1Migration } from 'cloudflare:test'

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database
    KV: KVNamespace
    PUBLIC_WEB_ORIGIN: string
    TEST_MIGRATIONS: D1Migration[]
  }
}
