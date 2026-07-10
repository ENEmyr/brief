# API reference

Base URL: `https://brief-api.algoryth.me`

There is no authentication. Possession of a session id grants access to that session, so treat session URLs as capability links. All request and response bodies are JSON unless noted. Errors always have the shape:

```json
{ "error": "Human-readable message." }
```

## Rate limits

Each write endpoint (`POST /api/session`, `PUT /api/session/:id/state`, `PUT /api/session/:id/save`) is limited to 10 requests per minute per client IP, counted separately per endpoint. Exceeding a limit returns `429` with an error message asking to retry in a minute. Read endpoints are not rate limited.

## Size caps

| Limit | Value | Where enforced |
| --- | --- | --- |
| Payload JSON (serialized) | 1,900,000 bytes | `POST /api/session`, returns 413 |
| Create request body | payload cap plus 65,536 bytes of envelope slack | `POST /api/session`, returns 413 |
| Reader state string | 262,144 characters | `PUT /api/session/:id/state`, returns 400 |
| State request body | 800,000 bytes | `PUT /api/session/:id/state`, returns 413 |
| Ciphertext | 1,950,000 bytes | `PUT /api/session/:id/save`, returns 413 |
| Save request body | 2,700,000 bytes | `PUT /api/session/:id/save`, returns 413 |

The ciphertext cap exists because D1 holds the ciphertext in a single row and base64 inflates it by roughly a third; in practice documents over about 1.4 MB of payload JSON cannot be encrypted.

## POST /api/session

Creates a session from a payload. The payload must satisfy the schema in `packages/schema/src/payload.ts`: a `meta` object with at least a `title`, at least one section with at least one block, and a `decisions` array (which may be empty).

Request body:

```json
{
  "payload": {
    "meta": { "title": "Add rate limiting to /api/session" },
    "sections": [
      {
        "id": "overview",
        "no": 1,
        "title": "Overview",
        "blocks": [
          { "type": "p", "text": "This document proposes rate limiting for the session endpoint." }
        ]
      }
    ],
    "decisions": []
  }
}
```

Response, `201`:

```json
{
  "id": "aB3xYz01qWe9rT",
  "url": "https://brief.algoryth.me/s/aB3xYz01qWe9rT"
}
```

Errors:

| Status | Meaning |
| --- | --- |
| 400 | Body is not valid JSON, or the payload fails schema validation. The message lists up to 10 validation issues with their paths. |
| 413 | The request body or the serialized payload exceeds the size caps above. |
| 429 | Rate limit exceeded. |

The new session gets a 7 day sliding expiry, measured from the last open.

## GET /api/session/:id

Returns the session envelope. Opening a session bumps its sliding expiry (7 days for unsaved sessions, 90 days for saved ones, measured from now; the expiry never moves backwards). Responses are served through a KV cache with a one hour TTL, falling back to D1.

Response, `200`:

```json
{
  "id": "aB3xYz01qWe9rT",
  "payload": "{\"meta\":{\"title\":\"...\"},\"sections\":[...],\"decisions\":[]}",
  "title": "Add rate limiting to /api/session",
  "saved": false,
  "encrypted": false,
  "encParams": null,
  "createdAt": 1767052800000,
  "lastOpenedAt": 1767052800000,
  "expiresAt": 1767657600000
}
```

`payload` is a string. For a plain session it is the payload JSON; for a protected session it is base64 ciphertext and `encParams` carries the client-side decryption parameters (`salt`, `iv`, `iterations`). The `title` of a protected session is an empty string. Timestamps are Unix epoch milliseconds.

Errors:

| Status | Meaning |
| --- | --- |
| 404 | No such session, or it has expired. Expired rows are deleted on first touch. |

## GET /api/session/:id/raw

Returns the session as clean, self-describing Markdown (`text/markdown; charset=utf-8`), intended for agents that want to re-read a document without scraping HTML. This also bumps the sliding expiry.

Errors:

| Status | Meaning |
| --- | --- |
| 403 | The session is protected. Content is end-to-end encrypted and only readable in the browser with the password. |
| 404 | No such session, or it has expired. |

## GET /api/session/:id/state

Returns the reader state blob (annotations and decision answers) previously synced for this session. The state is an opaque string owned by the client. If nothing has been synced, `state` is `null`; this endpoint does not check whether the session itself exists.

Response, `200`:

```json
{ "state": "{\"annotations\":[...],\"answers\":{...}}" }
```

## PUT /api/session/:id/state

Stores the reader state blob in KV with a 90 day TTL. The body is a JSON object with a single `state` string of at most 262,144 characters.

Request body:

```json
{ "state": "{\"annotations\":[...],\"answers\":{...}}" }
```

Response: `204` with no body.

Errors:

| Status | Meaning |
| --- | --- |
| 400 | Body is not valid JSON, or the state blob is invalid (wrong shape or over the character cap). |
| 403 | The session is protected. Plaintext reader state is never accepted for an encrypted session; state stays in browser memory only. |
| 404 | No such session. |
| 413 | Request body exceeds 800,000 bytes. |
| 429 | Rate limit exceeded. |

## PUT /api/session/:id/save

Marks a session as saved, extending its sliding expiry to 90 days from now. Two modes.

Plain save:

```json
{ "mode": "plain" }
```

Encrypt save. The client encrypts the payload JSON in the browser (PBKDF2-SHA256 key derivation, AES-256-GCM) and sends the base64 ciphertext plus the derivation parameters. `iterations` must be an integer between 100,000 and 5,000,000; the shipped client uses 600,000.

```json
{
  "mode": "encrypt",
  "ciphertext": "base64...",
  "encParams": {
    "salt": "base64...",
    "iv": "base64...",
    "iterations": 600000
  }
}
```

Response, `200` (both modes):

```json
{ "saved": true, "encrypted": true, "expiresAt": 1774828800000 }
```

For a plain save, `encrypted` reflects the session's existing state. Both modes invalidate the KV payload cache. An encrypt save additionally replaces the stored payload with the ciphertext, blanks the stored title, records `encParams`, and purges any plaintext reader state for the session.

Errors:

| Status | Meaning |
| --- | --- |
| 400 | Body is not valid JSON, or the save request does not match either mode. |
| 404 | No such session, or it has expired. |
| 409 | The session is already encrypted. Encryption is one way and cannot be re-applied or layered. |
| 413 | The request body exceeds 2,700,000 bytes, or the ciphertext exceeds 1,950,000 bytes (documents over about 1.4 MB cannot be protected). |
| 429 | Rate limit exceeded. |

## GET /health

Liveness probe. Returns `200` with:

```json
{ "ok": true }
```
