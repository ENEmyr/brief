import { API_URL } from '@/shared/api'
import { encryptImage } from './crypto'
import { ARCHIVE_FAILED, mapErrorStatus } from './api'

type JsonObject = Record<string, unknown>
type ImageBlock = JsonObject & { imageId: string }

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const objectsIn = (value: unknown): JsonObject[] => (Array.isArray(value) ? value.filter(isObject) : [])

// Walks the stored JSON, never a schema parse: a parse drops fields and blocks this reader does
// not know, and the archive must keep them. Image blocks sit at the top of a section or one level
// down inside details, the same two places the API links them from.
function imageBlocksIn(stored: unknown): ImageBlock[] {
  if (!isObject(stored)) return []
  return objectsIn(stored.sections)
    .flatMap((section) => objectsIn(section.blocks))
    .flatMap((block) => (block.type === 'details' ? objectsIn(block.blocks) : [block]))
    .filter((block): block is ImageBlock => block.type === 'image' && typeof block.imageId === 'string')
}

export function imageIdsIn(storedJson: string): string[] {
  return [...new Set(imageBlocksIn(JSON.parse(storedJson)).map((block) => block.imageId))]
}

export function withImageIds(storedJson: string, ids: ReadonlyMap<string, string>): string {
  // Nothing to swap: keep the stored string byte for byte, as an archive without images did.
  if (ids.size === 0) return storedJson
  const stored: unknown = JSON.parse(storedJson)
  for (const block of imageBlocksIn(stored)) block.imageId = ids.get(block.imageId) ?? block.imageId
  return JSON.stringify(stored)
}

// Two waits cover a limiter window that has not fully reset on the first retry; the cap stops a
// misreported Retry-After from holding the dialog busy for long.
const MAX_LIMIT_WAITS = 2
const MAX_RETRY_AFTER_SECONDS = 60

export type ResealResult =
  | { ok: true; ids: Map<string, string> }
  | { ok: false; error: string; status: number; uploaded: string[] }

// Resends while the limiter answers 429 with a Retry-After; null when the signal aborts a wait.
async function sendWithLimitWaits(
  send: () => Promise<Response>,
  wait: (ms: number) => Promise<void>,
  onWait?: (waiting: boolean) => void,
  signal?: AbortSignal,
): Promise<Response | null> {
  let res = await send()
  for (let waits = 0; res.status === 429 && waits < MAX_LIMIT_WAITS; waits++) {
    const seconds = Number(res.headers.get('retry-after'))
    if (!(seconds > 0)) break
    onWait?.(true)
    await wait(Math.min(seconds, MAX_RETRY_AFTER_SECONDS) * 1000)
    onWait?.(false)
    if (signal?.aborted) return null
    res = await send()
  }
  return res
}

/**
 * Deletes the encrypted copies a failed or cancelled archive uploaded, so they stop counting
 * toward the session's cap and a Retry starts clean. Best effort: a failure is logged, never
 * shown, and the copy expires with the session. The API refuses a copy an encrypted archive
 * references.
 */
export async function deleteImageCopies(sessionId: string, imageIds: string[]): Promise<void> {
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
  for (const imageId of imageIds) {
    const url = `${API_URL}/api/session/${encodeURIComponent(sessionId)}/image/${encodeURIComponent(imageId)}`
    try {
      const res = await sendWithLimitWaits(() => fetch(url, { method: 'DELETE' }), wait)
      if (res && !res.ok) console.warn(`Could not delete encrypted image copy ${imageId}: ${res.status}`)
    } catch (error) {
      console.warn(`Could not delete encrypted image copy ${imageId}`, error)
    }
  }
}

/**
 * Encrypts each plaintext image with the session key and uploads the copy, returning old id to
 * new id. It must finish before the encrypt-save: the upload route refuses an encrypted session,
 * and the save deletes the plaintext copies. An image the API no longer serves, or one that is
 * already ciphertext, keeps its id. A 429 that names its Retry-After (the upload limiter allows
 * 10 per 60 s per IP) waits that long and resumes at the same image, so a brief with more images
 * than the limit still finishes. Any other failure stops the flow before anything is saved, and
 * an aborted signal stops it before the next request or upload, including during a limiter wait.
 * A failed result lists the copies already uploaded, for deleteImageCopies.
 */
export async function resealImages(
  sessionId: string,
  imageIds: string[],
  key: CryptoKey,
  {
    signal,
    wait = (ms) =>
      new Promise((resolve) => {
        const timer = setTimeout(resolve, ms)
        signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer)
            resolve()
          },
          { once: true },
        )
      }),
    onWait,
  }: { signal?: AbortSignal; wait?: (ms: number) => Promise<void>; onWait?: (waiting: boolean) => void } = {},
): Promise<ResealResult> {
  const ids = new Map<string, string>()
  const failed = (status: number): ResealResult => ({
    ok: false,
    error: status === 429 ? mapErrorStatus(429) : ARCHIVE_FAILED,
    status,
    uploaded: [...ids.values()],
  })
  for (const imageId of imageIds) {
    if (signal?.aborted) return failed(0)
    try {
      const plain = await fetch(`${API_URL}/api/image/${encodeURIComponent(imageId)}`, { signal })
      if (plain.status === 404) continue
      if (!plain.ok) return failed(plain.status)
      const blob = await plain.blob()
      if (blob.type === 'application/octet-stream') continue
      const body = await encryptImage(new Uint8Array(await blob.arrayBuffer()), key)
      const upload = () =>
        fetch(`${API_URL}/api/session/${encodeURIComponent(sessionId)}/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body,
          signal,
        })
      if (signal?.aborted) return failed(0)
      const uploaded = await sendWithLimitWaits(upload, wait, onWait, signal)
      if (!uploaded) return failed(0)
      if (!uploaded.ok) return failed(uploaded.status)
      ids.set(imageId, ((await uploaded.json()) as { imageId: string }).imageId)
    } catch {
      return failed(0)
    }
  }
  return { ok: true, ids }
}
