import { describe, it, expect } from 'vitest'
import { sessionEnvelopeSchema } from '../src'

describe('sessionEnvelopeSchema', () => {
  it('parses a valid envelope', () => {
    const valid = {
      id: 'abc12345678901',
      title: 'Test Title',
      saved: false,
      encrypted: false,
      encParams: null,
      payload: '{"meta":{"title":"T"}}',
      createdAt: 1000,
      lastOpenedAt: 1000,
      expiresAt: 2000,
    }
    const result = sessionEnvelopeSchema.parse(valid)
    expect(result.id).toBe('abc12345678901')
    expect(result.title).toBe('Test Title')
  })

  it('rejects envelope missing encParams field but with encrypted true', () => {
    const invalid = {
      id: 'abc12345678901',
      title: 'Test Title',
      saved: true,
      encrypted: true,
      // encParams is missing
      payload: '{"meta":{"title":"T"}}',
      createdAt: 1000,
      lastOpenedAt: 1000,
      expiresAt: 2000,
    }
    expect(() => sessionEnvelopeSchema.parse(invalid)).toThrow()
  })
})
