import { z } from 'zod'

export const stateBody = z.object({ state: z.string().max(262_144) })
