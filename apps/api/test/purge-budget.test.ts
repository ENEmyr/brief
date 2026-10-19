import { describe, it, expect, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { PURGE_CALL_BUDGET, purgeExpired } from '../src/features/purge'
import type { AppEnv } from '../src/env'

const appEnv = env as unknown as AppEnv
const HOUR_MS = 60 * 60 * 1000

async function seedImages(count: number, sessionId: string | null, now: number): Promise<void> {
  const ids = Array.from({ length: count }, (_, i) => `img_budget${String(i).padStart(5, '0')}`)
  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000)
    await Promise.all(chunk.map((id) => appEnv.IMAGES.put(`images/${id}`, Uint8Array.from([1]))))
    await appEnv.DB.batch(
      chunk.map((id) =>
        appEnv.DB.prepare(
          'INSERT INTO images (id, session_id, content_type, encrypted, byte_size, created_at) VALUES (?, ?, ?, 0, 1, ?)',
        ).bind(id, sessionId, 'image/png', now - 2 * HOUR_MS),
      ),
    )
  }
}

// Counts every call the run makes through the D1 and R2 bindings, the calls Workers caps.
function counted(images: Pick<R2Bucket, 'delete' | 'list'>) {
  const calls = { d1: 0, r2: 0, deletedKeys: [] as string[] }
  const DB = new Proxy(appEnv.DB, {
    get(target, prop) {
      if (prop === 'prepare' || prop === 'batch') calls.d1++
      const value = Reflect.get(target, prop) as unknown
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  const IMAGES = {
    delete: async (keys: string | string[]) => {
      calls.r2++
      await images.delete(keys)
      calls.deletedKeys.push(...[keys].flat())
    },
    list: (options: R2ListOptions) => {
      calls.r2++
      return images.list(options)
    },
  }
  return { env: { ...appEnv, DB, IMAGES: IMAGES as unknown as R2Bucket }, calls }
}

const rowCount = async () => (await appEnv.DB.prepare('SELECT COUNT(*) AS n FROM images').first<{ n: number }>())!.n

describe('purgeExpired call budget', () => {
  it('stays within the budget and still deletes expired sessions when every R2 call fails', async () => {
    const now = Date.now()
    await appEnv.DB.prepare(
      'INSERT INTO sessions (id, payload, title, saved, encrypted, created_at, last_opened_at, expires_at) VALUES (?, ?, ?, 0, 0, ?, ?, ?)',
    ).bind('expiredbudget01', '{}', 't', now, now, now - 1000).run()
    await seedImages(1000, 'expiredbudget01', now)
    const down = () => Promise.reject(new TypeError('r2 down'))
    const run = counted({ delete: down, list: down })
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})

    const purged = await purgeExpired(run.env, now)
    logged.mockRestore()

    expect(run.calls.d1 + run.calls.r2).toBeLessThanOrEqual(PURGE_CALL_BUDGET)
    expect(purged).toEqual({ sessions: 1, images: 0 })
    expect(await appEnv.DB.prepare("SELECT id FROM sessions WHERE id = 'expiredbudget01'").first()).toBeNull()
    expect(await rowCount()).toBe(1000)
  }, 30_000)

  // A few hundred, not thousands: isolated storage copies every R2 object when the test ends, and
  // at 5000 that teardown lost its connection on CI runners.
  it('deletes 450 expired images under the budget, and a cut-off run leaves the rest for the next run', async () => {
    const now = Date.now()
    const count = 450
    const cutOffBudget = 100
    await seedImages(count, null, now)

    const first = counted(appEnv.IMAGES)
    const firstPurged = await purgeExpired(first.env, now, cutOffBudget)
    const firstTotal = first.calls.d1 + first.calls.r2
    expect(firstTotal).toBeLessThanOrEqual(cutOffBudget)
    expect(firstPurged.images).toBeGreaterThan(0)
    expect(firstPurged.images).toBeLessThan(count)
    expect(await rowCount()).toBe(count - firstPurged.images)

    const second = counted(appEnv.IMAGES)
    const secondPurged = await purgeExpired(second.env, now)
    const secondTotal = second.calls.d1 + second.calls.r2
    expect(secondTotal).toBeLessThanOrEqual(PURGE_CALL_BUDGET)
    expect(firstPurged.images + secondPurged.images).toBe(count)
    const deleted = [...first.calls.deletedKeys, ...second.calls.deletedKeys]
    expect(new Set(deleted).size).toBe(deleted.length)
    expect(deleted).toHaveLength(count)
    expect(await rowCount()).toBe(0)
    expect((await appEnv.IMAGES.list({ prefix: 'images/' })).objects).toEqual([])
  }, 30_000)
})
