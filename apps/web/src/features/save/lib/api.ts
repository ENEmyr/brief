import type { EncParams } from '@brief/schema'
import { API_URL } from '@/shared/api'

export type SaveRequestBody = { mode: 'plain' } | { mode: 'encrypt'; ciphertext: string; encParams: EncParams }

export type SaveApiResult = { ok: true } | { ok: false; error: string; status: number }

/** B-States error toast copy for a failure with no more specific reason. */
export const ARCHIVE_FAILED = 'Could not archive. Nothing was changed.'

export function mapErrorStatus(status: number): string {
  switch (status) {
    case 409:
      return 'Already protected'
    case 413:
      return 'Document too large to encrypt'
    case 429:
      return 'Too many attempts - try again in a minute'
    default:
      return ARCHIVE_FAILED
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
    return { ok: false, error: ARCHIVE_FAILED, status: 0 }
  }
  if (res.ok) return { ok: true }
  return { ok: false, error: mapErrorStatus(res.status), status: res.status }
}
