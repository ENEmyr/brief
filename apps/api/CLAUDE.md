# apps/api

Elysia app on a Cloudflare Worker, backed by D1 (via Drizzle) and KV. See the root CLAUDE.md for repo-wide rules.

## Layout

- `src/features/<feature>/` holds each vertical slice (session, save, state, purge). A slice contains `index.ts` (the slice's public surface: Elysia routes, or the scheduled-handler entry for purge), `service.ts` (D1/KV logic), and `model.ts` (Zod request body schemas); smaller slices omit files they do not need.
- The app is assembled in `src/app.ts` (`createApp`), and `src/index.ts` is the Worker entry point with the fetch and scheduled handlers.
- The D1 schema lives in `src/db/schema.ts`. Migrations live in `apps/api/drizzle/`, generated with `bun run db:generate` and applied with wrangler.
- Wrangler configuration is `wrangler.jsonc`, with `preview` and `production` environments on top of the local defaults.

## Zero-knowledge rule

The server must never see plaintext passwords or decrypted payloads. Concretely:

- Encrypting a session blanks its stored `title`, because the title is payload content.
- State PUTs against an encrypted session are rejected with 403.
- Encrypting purges the plaintext reader-state blob from KV, so pre-encryption excerpts do not outlive encryption.

Any new endpoint that touches sessions must preserve these guarantees.

## Validation and limits

- Validate payloads with the shared schema from `packages/schema` (`payloadSchema`, `MAX_PAYLOAD_BYTES`).
- Request size caps live in each feature's `model.ts` (for example the state body character cap and the save ciphertext caps). Keep new caps there.
- Rate limiting uses the optional `RATE_LIMITER` binding, checked at the top of each feature's route handlers with a per-feature key prefix.

## Tests

Tests live in `apps/api/test` and run through the root gate chain (`bun run test`, or `bun run test --filter=@brief/api`).
