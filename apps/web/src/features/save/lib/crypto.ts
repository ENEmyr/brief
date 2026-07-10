import type { EncParams } from '@brief/schema'

/**
 * Client-side end-to-end encryption for the optional password-protected Save
 * path (ADR-0001, decision log 131). Zero-knowledge: the password never
 * leaves this device, is never sent to the API, and is never logged. The
 * server only ever sees ciphertext + encParams.
 */
export const PBKDF2_ITERATIONS = 600_000

const SALT_BYTES = 16
const IV_BYTES = 12
// btoa/String.fromCharCode blow the call stack (and some engines' argument
// limits) on large typed arrays, so both directions convert in fixed-size
// chunks rather than spreading/joining the whole array at once.
const BASE64_CHUNK_SIZE = 0x8000

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + BASE64_CHUNK_SIZE)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const baseKey = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return globalThis.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptPayload(
  plaintext: string,
  password: string,
): Promise<{ ciphertext: string; encParams: EncParams }> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS)
  const ciphertextBuffer = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext),
  )
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertextBuffer)),
    encParams: {
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      iterations: PBKDF2_ITERATIONS,
    },
  }
}

// Throws (DOMException, GCM authentication failure) on a wrong password or
// tampered ciphertext -- this is WebCrypto's natural behavior and must never
// be caught here to produce a silent/garbled fallback result.
export async function decryptPayload(ciphertext: string, password: string, encParams: EncParams): Promise<string> {
  const salt = base64ToBytes(encParams.salt)
  const iv = base64ToBytes(encParams.iv)
  const key = await deriveKey(password, salt, encParams.iterations)
  const plaintextBuffer = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    base64ToBytes(ciphertext) as BufferSource,
  )
  return new TextDecoder().decode(plaintextBuffer)
}
