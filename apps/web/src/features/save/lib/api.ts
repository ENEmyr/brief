import type { EncParams } from '@brief/schema'
import { API_URL } from '@/shared/api'

export type SaveRequestBody = { mode: 'plain' } | { mode: 'encrypt'; ciphertext: string; encParams: EncParams }

export type SaveApiResult = { ok: true } | { ok: false; error: string; status: number }

function mapErrorStatus(status: number): string {
  switch (status) {
    case 409:
      return 'Already protected'
    case 413:
      return 'Document too large to encrypt'
    case 429:
      return 'Too many attempts - try again in a minute'
    default:
      return 'Archive failed'
  }
}

export async function saveSession(sessionId: string, body: SaveRequestBody): Promise<SaveApiResult> {
  let res: Response
  try {
    res = await fetch(`${API_URL}/api/session/${encodeURIComponent(sessionId)}/save`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, error: 'Archive failed', status: 0 }
  }
  if (res.ok) return { ok: true }
  return { ok: false, error: mapErrorStatus(res.status), status: res.status }
}
