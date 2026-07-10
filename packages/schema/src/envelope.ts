import { z } from 'zod'

export const encParamsSchema = z.object({
  salt: z.string().min(1),
  iv: z.string().min(1),
  iterations: z.number().int().min(100_000),
})

export const sessionEnvelopeSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  saved: z.boolean(),
  encrypted: z.boolean(),
  encParams: encParamsSchema.nullable(),
  payload: z.string(),
  createdAt: z.number(),
  lastOpenedAt: z.number(),
  expiresAt: z.number(),
})

export type SessionEnvelope = z.infer<typeof sessionEnvelopeSchema>
export type EncParams = z.infer<typeof encParamsSchema>
