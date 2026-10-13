declare module '*validate.mjs' {
  type Problem = { path: string; message: string }
  export function validatePayload(
    value: unknown,
    schema: unknown,
  ): { errors: Problem[]; warnings: Problem[] }
  export function readabilityHints(payload: unknown): Problem[]
}
