import { z } from 'zod'
import { payloadSchema } from '@brief/schema'

export const createSessionBody = z.object({ payload: payloadSchema })
export type CreateSessionBody = z.infer<typeof createSessionBody>
