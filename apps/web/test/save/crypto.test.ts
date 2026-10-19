import { describe, it, expect } from 'vitest'
import * as crypto from '@/features/save/lib/crypto'
import { PBKDF2_ITERATIONS, decryptPayload, encryptPayloadWithKey, newSessionKey } from '@/features/save/lib/crypto'

// SaveModal's path: a fresh session key, then the payload under it.
const encryptWithNewKey = async (plaintext: string, password: string) =>
  encryptPayloadWithKey(plaintext, await newSessionKey(password))

describe('encryptPayloadWithKey / decryptPayload', () => {
  it('exports no password-only encrypt, since SaveModal derives the key once for payload and images', () => {
    expect(Object.keys(crypto)).not.toContain('encryptPayload')
  })

  it('round-trips plaintext through encrypt then decrypt with the correct password', async () => {
    const { ciphertext, encParams } = await encryptWithNewKey('hello world', 'correct horse battery staple')
    const plaintext = await decryptPayload(ciphertext, 'correct horse battery staple', encParams)
    expect(plaintext).toBe('hello world')
  })

  it('round-trips a unicode (Thai) payload', async () => {
    const original = 'สวัสดีชาวโลก ทดสอบ 🎉'
    const { ciphertext, encParams } = await encryptWithNewKey(original, 'password123')
    const plaintext = await decryptPayload(ciphertext, 'password123', encParams)
    expect(plaintext).toBe(original)
  })

  it('throws on decrypt with the wrong password (GCM auth failure, no silent fallback)', async () => {
    const { ciphertext, encParams } = await encryptWithNewKey('secret document', 'right-password')
    await expect(decryptPayload(ciphertext, 'wrong-password', encParams)).rejects.toThrow()
  })

  it('reports iterations in the returned encParams', async () => {
    const { encParams } = await encryptWithNewKey('x', 'password123')
    expect(encParams.iterations).toBe(PBKDF2_ITERATIONS)
    expect(PBKDF2_ITERATIONS).toBe(600_000)
  })

  it('actually uses encParams.iterations for key derivation, not the module constant', async () => {
    const { ciphertext, encParams } = await encryptWithNewKey('custom-iter payload', 'pw')
    // A wrong iteration count derives a different key, so GCM auth must fail even
    // with the correct password and correct salt/iv -- proves iterations is a real
    // input to key derivation, not ignored in favor of PBKDF2_ITERATIONS.
    const wrongIterations = { ...encParams, iterations: encParams.iterations + 1 }
    await expect(decryptPayload(ciphertext, 'pw', wrongIterations)).rejects.toThrow()

    // Sanity: the original, correct encParams still decrypts fine.
    const plaintext = await decryptPayload(ciphertext, 'pw', encParams)
    expect(plaintext).toBe('custom-iter payload')
  })

  it('generates fresh random salt and iv on every call', async () => {
    const a = await encryptWithNewKey('same plaintext', 'same password')
    const b = await encryptWithNewKey('same plaintext', 'same password')
    expect(a.encParams.salt).not.toBe(b.encParams.salt)
    expect(a.encParams.iv).not.toBe(b.encParams.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  it('produces a large ciphertext without hitting call-stack limits (chunked base64)', async () => {
    const big = 'a'.repeat(500_000)
    const { ciphertext, encParams } = await encryptWithNewKey(big, 'password123')
    const plaintext = await decryptPayload(ciphertext, 'password123', encParams)
    expect(plaintext).toBe(big)
  })
})
