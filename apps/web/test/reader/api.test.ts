import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchSession, SessionNotFoundError, SessionFetchError } from '@/features/reader'

const valid = {
  id: 'abc12345678901',
  title: 'T',
  saved: false,
  encrypted: false,
  encParams: null,
  payload: JSON.stringify({
    meta: { title: 'T' },
    sections: [{ id: 's', no: 1, title: 'S', blocks: [{ type: 'p', text: 'x' }] }],
    decisions: [],
  }),
  createdAt: 1,
  lastOpenedAt: 1,
  expiresAt: 2,
}

afterEach(() => vi.unstubAllGlobals())

describe('fetchSession', () => {
  it('calls fetch with correct API_URL and session ID', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(valid)))
    vi.stubGlobal('fetch', mockFetch)
    await fetchSession('abc12345678901')
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8787/api/session/abc12345678901')
  })

  it('parses a plain session payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(valid))))
    const s = await fetchSession('abc12345678901')
    expect(s.payload?.meta.title).toBe('T')
    expect(s.encrypted).toBe(false)
  })

  it('keeps payload null for encrypted sessions', async () => {
    const enc = { ...valid, encrypted: true, payload: 'AAAA', encParams: { salt: 'a', iv: 'b', iterations: 600000 } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(enc))))
    const s = await fetchSession('abc12345678901')
    expect(s.payload).toBeNull()
    expect(s.raw).toBe('AAAA')
    expect(s.encParams?.iterations).toBe(600000)
  })

  it('throws SessionNotFoundError on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"x"}', { status: 404 })))
    await expect(fetchSession('nope')).rejects.toBeInstanceOf(SessionNotFoundError)
  })

  it('throws SessionFetchError on corrupt payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...valid, payload: '{"broken":' }))))
    await expect(fetchSession('abc12345678901')).rejects.toBeInstanceOf(SessionFetchError)
  })

  it('throws SessionFetchError on non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"x"}', { status: 500 })))
    await expect(fetchSession('abc12345678901')).rejects.toBeInstanceOf(SessionFetchError)
  })
})
