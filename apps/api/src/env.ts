export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

export interface AppEnv {
  DB: D1Database
  KV: KVNamespace
  IMAGES: R2Bucket
  RATE_LIMITER?: RateLimiter
  PUBLIC_WEB_ORIGIN: string
}
