---
name: brief
description: Use when research, analysis, review, or planning work ends in decisions a human must make (architecture choices, migration plans, incident reviews, dependency upgrades) and the findings are too large or too visual for chat. Publishes the work as an interactive document on Brief (https://brief.algoryth.me) that the human reads, annotates, and answers from, then replies back into the conversation.
---

# Publish a decision document to Brief

## Overview

Brief turns a piece of agent work into a web document the human can act on. You POST one JSON payload; the API returns a URL; the human opens it, reads the sections, answers the decision cards, and pastes a generated reply back into this conversation. You then act on their answers.

The payload has exactly three top-level keys: `meta`, `sections`, and `decisions`. Everything the reader sees is built from those.

## When to use

Use it after work that leaves the human with a choice to make: which of two architectures, whether to take the migration now, which incident fix to fund, whether to accept the breaking upgrade. The document is worth its cost when the reader needs evidence in front of them to choose well.

Do not use it for an answer that fits in chat, for a status update with nothing to decide, or as a dumping ground for a report. A payload with an empty `decisions` array is allowed by the schema but is usually a sign the work belongs in chat instead.

## Workflow

1. **Research and verify.** Read the real files, trace the real code paths, run the real commands. Every number, path, and claim that reaches the payload must come from something you actually saw. Collect file paths as you go; you will cite them in the prose.
2. **Plan the sections.** One topic per section, in reading order, numbered from 1. A common shape: the problem, the evidence, the options, the recommendation.
3. **Pick blocks deliberately.** Read `BLOCKS.md` in this skill directory before writing any block. It has the exact fields, the exact enum values, and a valid JSON example for all 22 block types, plus a table matching each kind of content to the right block.
4. **Write the decisions last**, so the options reflect what the research actually found. Each decision needs two or more options with honest `detail` text, and usually a `why` that states your recommendation and its cost.
5. **Validate before publishing.** Write the payload to a file and run `node <skill-dir>/validate.mjs payload.json`. It is offline, needs no install, and it rejects exactly what the API rejects. Do not skip it; a failed POST costs a request against a ten-per-minute limit and returns at most ten of the problems.
6. **Publish and hand over the URL.** Give the human the link and nothing else; the document carries the content now.
7. **Act on the reply.** The human pastes a generated prompt back into the conversation. See "What comes back" below.

This skill directory holds three things you will use: `BLOCKS.md` (every field of every block), `example.payload.json` (a complete, valid document to model yours on), and `validate.mjs` (the pre-flight check).

## The envelope

The request body wraps the payload in a `payload` key. Nothing else in the body is read.

```text
{ "payload": { "meta": <meta object>, "sections": [<section>, ...], "decisions": [<decision>, ...] } }
```

The smallest document the API accepts:

```json
{
  "payload": {
    "meta": { "title": "Add rate limiting to /api/session" },
    "sections": [
      {
        "id": "overview",
        "no": 1,
        "title": "Overview",
        "blocks": [{ "type": "p", "text": "The session endpoint accepts unbounded writes today." }]
      }
    ],
    "decisions": []
  }
}
```

### `meta`

`title` is the only required field. All of `author`, `role`, `date`, `version`, `repo`, `readTime`, `docId`, and `subtitle` are optional strings; each is capped at 300 characters except `date` and `repo`, which are free strings.

### `sections`

At least one. Each needs `id` (short, unique, used as the URL fragment), `no` (integer of 1 or more, the number the reader sees), `title`, and `blocks` (at least one).

### `decisions`

May be empty. Each decision needs `id`, `q`, `multi`, and at least two `opts`. Set `multi` to `false` for an either-or choice and `true` when several options can be taken together. The full field reference, including the two fields agents habitually get wrong (`cmp` and `dia`), is in `BLOCKS.md`.

## Validating the payload

Write the payload to a file and run the validator that ships with this skill. Do this before every POST; it costs nothing and it is the difference between one request and a guess-and-retry loop against a rate limit of ten per minute.

```sh
node <skill-dir>/validate.mjs payload.json
```

It takes either the bare payload or the `{"payload": ...}` envelope, and it needs no install: no npm, no network, no dependencies. Node 18 or later, or Bun, is enough.

A clean payload:

```text
Valid. 4553 bytes, 3 section(s), 2 decision(s).
```

A broken one, one line per problem, exiting non-zero:

```text
warning  sections.0.blocks.1.items.0.color: Unknown field. The API strips it; it will never render.
sections.1.blocks.0.head: Invalid input: expected array, received undefined
decisions.0.opts: Too small: expected array to have >=2 items

2 problem(s). The API would reject this payload with a 400.
```

Read a path literally: `sections.1.blocks.0.head` is the `head` field of the first block of the second section. Fix exactly the paths named, then re-run until it passes.

Warnings are different from errors. A warning means the API will accept the payload but the field you wrote does nothing, because the schema strips keys it does not know. `sections.0.blocks.1.items.0.color` is a real example: the field is called `tone`, so a block with `color` publishes and renders with no colour at all. Treat a warning as a silently broken block, not as a nit.

The validator reads `payload.schema.json`, which is generated from the same Zod schema the API validates with, and a test in the ENEmyr/brief repository fails if the two ever drift. So a payload this script accepts is a payload the API accepts.

If the script cannot run in your environment, the API is still the backstop: it rejects an invalid payload with a 400 whose `error` string names each failing path in the same `path: message` form.

```json
{ "error": "sections.0.blocks.2.head: Invalid input: expected array, received string; decisions.0.opts: Too small: expected array to have >=2 items" }
```

At most ten issues are reported per 400, so a long list may be truncated. That truncation is the reason to validate locally first.

## Publishing

```bash
curl -sS -X POST https://brief-api.algoryth.me/api/session \
  -H 'content-type: application/json' \
  -d @payload.json
```

Write the payload to a file and POST it with `-d @file`. Inlining a large JSON document as a shell argument invites quoting bugs that look like schema errors.

### Responses

| Status | Body | What to do |
| --- | --- | --- |
| 201 | `{ "id": "aB3xYz01qWe9rT", "url": "https://brief.algoryth.me/s/aB3xYz01qWe9rT" }` | Give the `url` to the human. Keep the `id`. |
| 400 | `{ "error": "path: message; path: message" }` | Fix the named paths and re-POST. |
| 413 | `{ "error": "Payload exceeds 1900000 bytes." }` | Cut content. Long code and raw command output are the usual cause; move them into a `details` block or drop them. |
| 429 | `{ "error": "Rate limit exceeded. Try again in a minute." }` | Ten creations per minute per IP. Wait; do not retry in a loop. |
| 404 | `{ "error": "Session not found or expired." }` | The id is wrong or the session has expired. |
| 403 | `{ "error": "This session is protected..." }` | The reader encrypted it; the content is no longer readable by you. |

### Reading a document back

`GET https://brief-api.algoryth.me/api/session/<id>/raw` returns the document as markdown. It contains only the payload you sent, never the reader's annotations or answers, and it returns 403 once the reader password-protects the session. Keep your own copy of any payload you may need later rather than relying on this endpoint.

## What comes back

The reader replies by pasting a generated prompt into this conversation. There are two shapes, both plain text. Recognise them and act; do not ask the human to restate them.

**Decision answers**, generated by the decision stepper, one block per decision:

```text
Reply to the "Rate limiting for /api/session" doc (session aB3xYz01qWe9rT) - my decisions:

[limiter-choice] Which rate limiter should we put in front of POST /api/session?
  - Choice: Cloudflare Rate Limiting binding
  - Note: Ship it behind a flag.

[rollout] How should the limit reach production?
  - Choice: Shadow mode for one week; Alert on sustained 429s

Please act on the answers above; consider the extra context for any item that has a note
```

The bracketed name is the decision `id` you set. `Choice` holds option **labels**, semicolon-separated when `multi` is true, or `(not answered)`. A `Note` is free text the reader added, and it usually carries a constraint that changes the work; treat it as part of the answer, not as decoration.

**A question about a passage**, generated when the reader highlights text and asks about it:

```text
Question about a specific part of the "Rate limiting for /api/session" doc (session aB3xYz01qWe9rT).

Reference:
- URL: https://brief.algoryth.me/s/aB3xYz01qWe9rT#evidence
- Location: section 02 "What the traffic shows" - paragraph 3 - chars 41-118
- Quoted text: "the free D1 tier throttles within four minutes"

Question:
Where does the four minute figure come from?

Please answer specifically about the quoted part above, using the reference to locate it.
```

Answer the quoted passage specifically. If the answer changes a claim in the document, say so plainly: a published document is immutable, so a correction lives in the conversation or in a new document.

Design the decisions so this loop closes in one pass. A question the human cannot settle from the document alone is a question that comes back as another round trip.

## Common mistakes

| Mistake | Reality |
| --- | --- |
| Putting Mermaid source in a decision's `dia` | `dia` is a plain string label, rendered literally as `[diagram: <your string>]`. For a real diagram, put a `seq`, `state`, `layers`, or `mermaid` block in the section that sets the decision up. |
| Including `"type": "table"` inside a decision's `cmp` | `cmp` is a table shape with the `type` key removed: `{ head, rows, caption? }`. |
| Numbers in `table.rows` cells | Cells are strings. Write `"48120"`, not `48120`. |
| Nesting a `details` inside a `details` | Rejected by the schema. Flatten it. |
| A diagram in every section | Most good documents are mostly `p` and `table`. Reach for a diagram when the data has a shape that prose loses. |
| Publishing unverified claims | Every number and path must come from the research phase. A confident wrong document is worse than no document. |
| Retrying a 429 in a loop | Ten creations per minute. Fix the payload offline, then POST once. |
| POSTing without running `validate.mjs` | The script is offline and free; a rejected POST is not. Validate, then publish. |
| Ignoring a warning from `validate.mjs` | A warning is a field the API strips and the reader never sees, such as `color` where the schema says `tone`. The block publishes silently broken. |

## Writing rules for the document

- Verified facts only. Cite file paths in the prose so the reader can check the evidence.
- One topic per section, in reading order.
- Plain language, plain ASCII. No emoji in payload text, and no em-dash or en-dash; use a plain hyphen.
- Honest `detail` on every option. An option with no downside listed reads as a sales pitch, and it costs the reader their trust in the rest of the document.
