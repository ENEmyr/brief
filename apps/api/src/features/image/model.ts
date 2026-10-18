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

const uint32 = (bytes: Uint8Array, at: number, littleEndian = false): number =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(at, littleEndian)

// Signature, then a chunk walk that must see IDAT and end exactly on IEND.
function isPng(bytes: Uint8Array): boolean {
  // A PNG must open with its complete 13-byte IHDR chunk, so a bare signature is not one.
  if (!startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...ascii('IHDR')])) return false
  let sawData = false
  for (let at = 8; at + 12 <= bytes.length; ) {
    const end = at + 12 + uint32(bytes, at)
    if (startsWith(bytes, ascii('IDAT'), at + 4)) sawData = true
    if (startsWith(bytes, ascii('IEND'), at + 4)) return sawData && end === bytes.length
    at = end
  }
  return false
}

// shortcut: checks the start and end markers only, not the segments between; walk the
// segments if a header plus end marker upload ever matters.
const isJpeg = (bytes: Uint8Array): boolean =>
  bytes.length > 4 && startsWith(bytes, [0xff, 0xd8, 0xff]) && startsWith(bytes, [0xff, 0xd9], bytes.length - 2)

// shortcut: needs a 0x2C (image descriptor) byte after the color table and a 0x3B trailer,
// without walking the blocks; walk them if a crafted header plus trailer upload ever matters.
function isGif(bytes: Uint8Array): boolean {
  if (!(startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))) || bytes.length < 14) return false
  const flags = bytes[10]!
  const colorTable = flags & 0x80 ? 3 * 2 ** ((flags & 7) + 1) : 0
  return bytes[bytes.length - 1] === 0x3b && bytes.indexOf(0x2c, 13 + colorTable) !== -1
}

// The RIFF size covers the whole file and the first chunk is an image chunk that fits in it.
function isWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 20 || !startsWith(bytes, ascii('RIFF')) || !startsWith(bytes, ascii('WEBP'), 8)) return false
  const chunk = ['VP8 ', 'VP8L', 'VP8X'].some((type) => startsWith(bytes, ascii(type), 12))
  return chunk && uint32(bytes, 4, true) + 8 === bytes.length && 20 + uint32(bytes, 16, true) <= bytes.length
}

// The declared Content-Type is ignored: only these structures are accepted, so SVG (text),
// anything renamed to look like an image, and a bare header are rejected.
export function sniffImageType(bytes: Uint8Array): ImageContentType | null {
  if (isPng(bytes)) return 'image/png'
  if (isJpeg(bytes)) return 'image/jpeg'
  if (isGif(bytes)) return 'image/gif'
  if (isWebp(bytes)) return 'image/webp'
  return null
}
