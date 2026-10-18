import { describe, it, expect, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { purgeExpired } from '../src/features/purge'
import worker from '../src/index'
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
    expect(purged).toEqual({ sessions: 1, images: 0 })
    expect(await appEnv.DB.prepare("SELECT id FROM sessions WHERE id = 'expired00000001'").first()).toBeNull()
    expect(await appEnv.DB.prepare("SELECT id FROM sessions WHERE id = 'alive00000000001'").first()).not.toBeNull()
  })

  it('logs the purged image count next to the purged session count', async () => {
    const now = Date.now()
    await appEnv.DB.prepare(
      'INSERT INTO sessions (id, payload, title, saved, encrypted, created_at, last_opened_at, expires_at) VALUES (?, ?, ?, 0, 0, ?, ?, ?)',
    ).bind('expired00000002', '{}', 't', now, now, now - 1000).run()
    await appEnv.DB.prepare(
      'INSERT INTO images (id, session_id, content_type, encrypted, byte_size, created_at) VALUES (?, NULL, ?, 0, 1, ?)',
    ).bind('img_orphan0000000001', 'image/png', now - 2 * 60 * 60 * 1000).run()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await worker.scheduled()
    expect(log).toHaveBeenCalledTimes(1)
    expect(JSON.parse(log.mock.calls[0]![0] as string)).toMatchObject({ event: 'purge', sessions: 1, images: 1 })
    log.mockRestore()
  })
})
