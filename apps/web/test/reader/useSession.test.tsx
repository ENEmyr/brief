import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSession } from '@/features/reader'

afterEach(() => vi.unstubAllGlobals())

describe('useSession', () => {
  it('goes loading then notfound on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"x"}', { status: 404 })))
    const { result } = renderHook(() => useSession('missing12345678'))
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('notfound'))
  })
})
