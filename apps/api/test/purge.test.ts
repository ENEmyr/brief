import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:test'
import { purgeExpired } from '../src/features/purge'
import type { AppEnv } from '../src/env'

const appEnv = env as unknown as AppEnv

describe('purgeExpired', () => {
  it('deletes only expired rows', async () => {
    const now = Date.now()
    const insert = (id: string, expiresAt: number) =>
      appEnv.DB.prepare(
        'INSERT INTO sessions (id, payload, title, saved, encrypted, created_at, last_opened_at, expires_at) VALUES (?, ?, ?, 0, 0, ?, ?, ?)',
      ).bind(id, '{}', 't', now, now, expiresAt).run()
    await insert('expired00000001', now - 1000)
    await insert('alive00000000001', now + 1000000)
    const purged = await purgeExpired(appEnv, now)
    expect(purged).toBe(1)
    expect(await appEnv.DB.prepare("SELECT id FROM sessions WHERE id = 'expired00000001'").first()).toBeNull()
    expect(await appEnv.DB.prepare("SELECT id FROM sessions WHERE id = 'alive00000000001'").first()).not.toBeNull()
  })
})
