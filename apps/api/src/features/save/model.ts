import { z } from 'zod'

export const saveBody = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('plain') }),
  z.object({
    mode: z.literal('encrypt'),
    ciphertext: z.string().min(1).max(2_600_000),
    encParams: z.object({
      salt: z.string().min(1).max(128),
      iv: z.string().min(1).max(64),
      iterations: z.number().int().min(100_000).max(5_000_000),
    }),
  }),
])
export type SaveBody = z.infer<typeof saveBody>
