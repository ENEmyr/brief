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

// Signature, then a chunk walk that must see IDAT and reach a complete IEND. Bytes after
// IEND are allowed: camera files carry them (MPF, maker notes, motion photos).
function isPng(bytes: Uint8Array): boolean {
  // A PNG must open with its complete 13-byte IHDR chunk, so a bare signature is not one.
  if (!startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...ascii('IHDR')])) return false
  let sawData = false
  for (let at = 8; at + 12 <= bytes.length; ) {
    const end = at + 12 + uint32(bytes, at)
    if (startsWith(bytes, ascii('IDAT'), at + 4)) sawData = true
    if (startsWith(bytes, ascii('IEND'), at + 4)) return sawData && end <= bytes.length
    at = end
  }
  return false
}

// SOF0..SOF15, except DHT (C4), JPG (C8) and DAC (CC), which share the range.
const isFrameMarker = (marker: number): boolean =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc

// A segment walk from SOI that must see a frame header, then a scan, then reach EOI. Bytes after
// EOI are allowed, as for PNG. Inside scan data, FF 00 is a stuffed byte and FF D0..D7 a restart.
function isJpeg(bytes: Uint8Array): boolean {
  if (!startsWith(bytes, [0xff, 0xd8])) return false
  let sawFrame = false
  let inScan = false
  for (let at = 2; at + 1 < bytes.length; ) {
    if (bytes[at] !== 0xff) {
      if (!inScan) return false
      at = bytes.indexOf(0xff, at)
      if (at === -1) return false
      continue
    }
    const marker = bytes[at + 1]!
    if (marker === 0xd9) return inScan
    if (marker === 0xff) at += 1
    else if (inScan && (marker === 0 || (marker >= 0xd0 && marker <= 0xd7))) at += 2
    else {
      if (at + 4 > bytes.length) return false
      const end = at + 2 + ((bytes[at + 2]! << 8) | bytes[at + 3]!)
      if (end < at + 4 || end > bytes.length) return false
      if (isFrameMarker(marker)) sawFrame = true
      if (marker === 0xda) {
        if (!sawFrame) return false
        inScan = true
      }
      at = end
    }
  }
  return false
}

// shortcut: needs a 0x2C (image descriptor) byte after the color table and a 0x3B trailer
// after it, without walking the blocks; walk them if a crafted upload ever matters.
function isGif(bytes: Uint8Array): boolean {
  if (!(startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))) || bytes.length < 14) return false
  const flags = bytes[10]!
  const colorTable = flags & 0x80 ? 3 * 2 ** ((flags & 7) + 1) : 0
  const descriptor = bytes.indexOf(0x2c, 13 + colorTable)
  return descriptor !== -1 && bytes.indexOf(0x3b, descriptor + 1) !== -1
}

// The RIFF size fits in the file (bytes after it are allowed) and the first chunk is an image
// chunk that fits in the RIFF.
function isWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 20 || !startsWith(bytes, ascii('RIFF')) || !startsWith(bytes, ascii('WEBP'), 8)) return false
  const chunk = ['VP8 ', 'VP8L', 'VP8X'].some((type) => startsWith(bytes, ascii(type), 12))
  const riffEnd = uint32(bytes, 4, true) + 8
  return chunk && riffEnd <= bytes.length && 20 + uint32(bytes, 16, true) <= riffEnd
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
