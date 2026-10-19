import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config'
import { unstable_readConfig } from 'wrangler'

// The deployed limiter period per environment, so a test can hold retry-after to it.
function limiterPeriod(env: string): number | null {
  const { unsafe } = unstable_readConfig({ config: './wrangler.jsonc', env }, { hideWarnings: true })
  const limiter = unsafe.bindings?.find((binding: { name: string }) => binding.name === 'RATE_LIMITER') as { simple?: { period?: number } } | undefined
  return limiter?.simple?.period ?? null
}

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations('./drizzle')
  return {
    test: {
      setupFiles: ['./test/patch-function.ts', './test/apply-migrations.ts'],
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.jsonc' },
          miniflare: {
            bindings: {
              TEST_MIGRATIONS: migrations,
              TEST_LIMITER_PERIODS: { preview: limiterPeriod('preview'), production: limiterPeriod('production') },
            },
          },
        },
      },
    },
  }
})
