export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
// AES-GCM adds a 16 byte tag and the client prepends its 12 byte IV; the rest is headroom.
export const MAX_ENCRYPTED_IMAGE_BYTES = MAX_IMAGE_BYTES + 1024
export const MAX_IMAGES_PER_SESSION = 50
export const ORPHAN_WINDOW_MS = 60 * 60 * 1000
export const ENCRYPTED_CONTENT_TYPE = 'application/octet-stream'

export type ImageContentType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
  bytes.length >= offset + signature.length && signature.every((b, i) => bytes[offset + i] === b)

const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0))

// The declared Content-Type is ignored: only these signatures are accepted, so SVG (text)
// and anything renamed to look like an image are rejected.
export function sniffImageType(bytes: Uint8Array): ImageContentType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))) return 'image/gif'
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'image/webp'
  return null
}
