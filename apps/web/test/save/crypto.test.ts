import { describe, it, expect } from 'vitest'
import { PBKDF2_ITERATIONS, encryptPayload, decryptPayload } from '@/features/save/lib/crypto'

describe('encryptPayload / decryptPayload', () => {
  it('round-trips plaintext through encrypt then decrypt with the correct password', async () => {
    const { ciphertext, encParams } = await encryptPayload('hello world', 'correct horse battery staple')
    const plaintext = await decryptPayload(ciphertext, 'correct horse battery staple', encParams)
    expect(plaintext).toBe('hello world')
  })

  it('round-trips a unicode (Thai) payload', async () => {
    const original = 'สวัสดีชาวโลก ทดสอบ 🎉'
    const { ciphertext, encParams } = await encryptPayload(original, 'password123')
    const plaintext = await decryptPayload(ciphertext, 'password123', encParams)
    expect(plaintext).toBe(original)
  })

  it('throws on decrypt with the wrong password (GCM auth failure, no silent fallback)', async () => {
    const { ciphertext, encParams } = await encryptPayload('secret document', 'right-password')
    await expect(decryptPayload(ciphertext, 'wrong-password', encParams)).rejects.toThrow()
  })

  it('reports iterations in the returned encParams', async () => {
    const { encParams } = await encryptPayload('x', 'password123')
    expect(encParams.iterations).toBe(PBKDF2_ITERATIONS)
    expect(PBKDF2_ITERATIONS).toBe(600_000)
  })

  it('actually uses encParams.iterations for key derivation, not the module constant', async () => {
    const { ciphertext, encParams } = await encryptPayload('custom-iter payload', 'pw')
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
    const a = await encryptPayload('same plaintext', 'same password')
    const b = await encryptPayload('same plaintext', 'same password')
    expect(a.encParams.salt).not.toBe(b.encParams.salt)
    expect(a.encParams.iv).not.toBe(b.encParams.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  it('produces a large ciphertext without hitting call-stack limits (chunked base64)', async () => {
    const big = 'a'.repeat(500_000)
    const { ciphertext, encParams } = await encryptPayload(big, 'password123')
    const plaintext = await decryptPayload(ciphertext, 'password123', encParams)
    expect(plaintext).toBe(big)
  })
})
