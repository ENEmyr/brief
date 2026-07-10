import { payloadSchema, sessionEnvelopeSchema, type Payload, type EncParams } from '@brief/schema'

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

// Re-export EncParams for backward compatibility
export type { EncParams }

export interface SessionData {
  id: string
  title: string
  saved: boolean
  encrypted: boolean
  encParams: EncParams | null
  payload: Payload | null
  raw: string
  createdAt: number
  expiresAt: number
}

export class SessionNotFoundError extends Error {}
export class SessionFetchError extends Error {}

export async function fetchSession(id: string): Promise<SessionData> {
  let res: Response
  try {
    res = await fetch(`${API_URL}/api/session/${encodeURIComponent(id)}`)
  } catch {
    throw new SessionFetchError('Network error while loading the session.')
  }
  if (res.status === 404) throw new SessionNotFoundError('Session not found or expired.')
  if (!res.ok) throw new SessionFetchError(`Unexpected response ${res.status}.`)

  try {
    const body = sessionEnvelopeSchema.parse(await res.json())
    let payload: Payload | null = null
    if (!body.encrypted) {
      payload = payloadSchema.parse(JSON.parse(body.payload))
    }
    return {
      id: body.id,
      title: body.title,
      saved: body.saved,
      encrypted: body.encrypted,
      encParams: body.encParams,
      payload,
      raw: body.payload,
      createdAt: body.createdAt,
      expiresAt: body.expiresAt,
    }
  } catch {
    throw new SessionFetchError('Malformed session data.')
  }
}
