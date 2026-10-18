import { describe, it, expect, vi, afterEach } from 'vitest'
import { newSessionKey } from '@/features/save/lib/crypto'
import { resealImages } from '@/features/save/lib/images'

const API_URL = 'http://localhost:8787'
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
const LIMIT = 10
const PERIOD_MS = 60_000

afterEach(() => {
  vi.unstubAllGlobals()
})

// The production binding (wrangler.jsonc, simple 10 per 60 s) on one key, image:<ip>, over a
// fake clock the injected wait moves forward. The API answers its 429 with retry-after: 60.
function stubLimitedApi() {
  let clock = 0
  const accepted: number[] = []
  const refused: number[] = []
  let next = 0
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (!init?.method) return new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } })
    if (url !== `${API_URL}/api/session/sess1/image`) throw new Error(`unexpected ${url}`)
    if (accepted.filter((at) => at > clock - PERIOD_MS).length >= LIMIT) {
      refused.push(clock)
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again in a minute.' }), {
        status: 429,
        headers: { 'retry-after': '60' },
      })
    }
    accepted.push(clock)
    next++
    return new Response(JSON.stringify({ imageId: `img_sealed${String(next).padStart(9, '0')}` }), { status: 201 })
  })
  const wait = async (ms: number) => {
    clock += ms
  }
  return { wait, accepted, refused, now: () => clock }
}

describe('resealImages under the production upload limiter', () => {
  it('archives a brief with 12 images to the end, waiting out the limit instead of failing', async () => {
    const api = stubLimitedApi()
    const ids = Array.from({ length: 12 }, (_, i) => `img_plain${String(i + 1).padStart(10, '0')}`)
    const { key } = await newSessionKey('password123')

    const result = await resealImages('sess1', ids, key, { wait: api.wait })

    expect(result).toEqual({
      ok: true,
      ids: new Map(ids.map((id, i) => [id, `img_sealed${String(i + 1).padStart(9, '0')}`])),
    })
    expect(api.accepted).toHaveLength(12)
    // Image 11 was refused once, then the flow resumed from image 11, not from image 1.
    expect(api.refused).toEqual([0])
    expect(api.now()).toBe(60_000)
  })
})
