# Architecture

Brief is two deployables on Cloudflare plus a shared schema package. The reader UI is a statically exported Next.js site served from Cloudflare Pages at `brief.algoryth.me`. The API is an Elysia app running on a Cloudflare Worker at `brief-api.algoryth.me`, backed by D1 for session storage and KV for a payload read-through cache and for reader state blobs. A daily cron trigger on the Worker purges expired sessions.

## Infrastructure

```mermaid
flowchart TD
  Agent[Coding agent] -->|POST /api/session| Worker
  Reader[Reader browser] -->|GET /s/id| Pages["Cloudflare Pages (brief.algoryth.me), static Next.js export"]
  Pages -->|serves the client app| Reader
  Reader -->|JSON over HTTPS| Worker["Worker API (brief-api.algoryth.me), Elysia"]
  Worker --> D1[("D1: sessions table")]
  Worker --> KV[("KV: payload cache + reader state")]
  Cron["Cron trigger, daily 03:00 UTC"] -->|purge expired sessions| Worker
```

D1 holds the sessions table: id, payload (JSON or ciphertext), title, saved and encrypted flags, encryption params, and the timestamps that drive the sliding expiry. KV holds two kinds of keys: `payload:id` is a one hour read-through cache of the session row, and `state:id` is the reader state blob (annotations and decision answers) with a 90 day TTL.

## Data flow

The publish, read, and state-sync path:

```mermaid
sequenceDiagram
  participant Agent
  participant Worker as Worker API
  participant D1
  participant KV
  participant Reader as Reader browser
  Agent->>Worker: POST /api/session (payload JSON)
  Worker->>D1: insert session, 7 day expiry
  Worker-->>Agent: 201 { id, url }
  Reader->>Worker: GET /api/session/:id
  Worker->>KV: read payload:id
  Worker->>D1: fall back on cache miss, bump sliding expiry
  Worker->>KV: refresh payload:id (1 hour TTL)
  Worker-->>Reader: session envelope
  Reader->>Worker: GET /api/session/:id/state
  Worker->>KV: read state:id
  Worker-->>Reader: { state }
  Reader->>Worker: PUT /api/session/:id/state (on changes)
  Worker->>KV: write state:id (90 day TTL)
```

The save, encrypt, and unlock path. Encryption is entirely client side: the browser derives an AES-256-GCM key from the reader's password with PBKDF2-SHA256 at 600000 iterations, encrypts the payload JSON, and sends only the ciphertext and the derivation parameters. The server never sees the password or a derived key.

```mermaid
sequenceDiagram
  participant Reader as Reader browser
  participant Worker as Worker API
  participant D1
  participant KV
  Note over Reader: plain save
  Reader->>Worker: PUT /api/session/:id/save { mode: "plain" }
  Worker->>D1: set saved flag, extend expiry to 90 days
  Worker-->>Reader: { saved, encrypted, expiresAt }
  Note over Reader: encrypt save
  Reader->>Reader: PBKDF2-SHA256 (600000 iterations) derives AES-256-GCM key
  Reader->>Reader: encrypt payload JSON with random salt and IV
  Reader->>Worker: PUT /api/session/:id/save { mode: "encrypt", ciphertext, encParams }
  Worker->>D1: store ciphertext, blank the title, set encrypted flag
  Worker->>KV: delete payload:id and state:id (plaintext purge)
  Worker-->>Reader: { saved, encrypted: true, expiresAt }
  Note over Reader,Worker: unlock
  Reader->>Worker: GET /api/session/:id
  Worker-->>Reader: envelope with ciphertext and encParams
  Reader->>Reader: derive key from entered password, decrypt in browser
```

After an encrypt save the server also rejects any further `PUT /api/session/:id/state` for that session with 403, so plaintext reader state can never be re-created against a protected document. Reader state for a protected session lives in browser memory only.

## Monorepo layout

The repository is a Bun and Turborepo monorepo. `apps/web` is the Next.js reader UI, built as a static export. `apps/api` is the Elysia Worker with the D1 schema, migrations, and the session, save, state, and purge features. `packages/schema` is the Zod payload schema and the markdown export, shared by both apps so the API validates exactly what the UI renders. `packages/config` holds shared tooling configuration. `e2e` contains the Playwright tests that run the web and API pair together against local wrangler dev servers.

## Frontend serving details

The Pages site is a fully static export, so there is no per-session server rendering. A `_redirects` rule (`/s/* /s/ 200`) rewrites every session URL to the same client-rendered page, which then fetches the session envelope from the API by id. Heavy renderers (Shiki syntax highlighting, KaTeX math, and the chart and diagram components) are lazy loaded so a document that does not use them does not pay for them on first paint.

## Deploys

Deployment is trunk based and tag gated. Every push to `main` deploys the preview environment: the `brief-api-preview` Worker and the Pages preview at `main.brief-web-d38.pages.dev`, including D1 migrations. Production deploys only when a `v*` tag is pushed; that workflow applies migrations to the production D1 database and deploys the production Worker and Pages project behind the custom domains. Preview therefore moves faster than production and may show newer features first.
