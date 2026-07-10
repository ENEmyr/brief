---
name: brief
description: Publish research, analysis, or review work as an interactive decision document on Brief (https://brief.algoryth.me). Use after work that ends in decisions the human must make, such as architecture choices, migration plans, incident reviews, or dependency upgrades. The agent POSTs one JSON payload of sections, diagrams, charts, and decision questions, then hands the human a single link to read, annotate, and answer from.
---

# Publish a decision document to Brief

## When to use

Use this skill after research or analysis work that ends in decisions the human must make: architecture choices, migration plans, incident reviews, dependency upgrades. The document gives the human sections to read, diagrams and tables to inspect, and decision cards to answer inline. Do not use it for trivial answers that fit in chat; a payload without real decisions is just a report.

## Working process

### Phase 1: Research and verify

Read the actual source files involved. Trace real code paths. Verify claims against tests and configuration. Never write a claim into the document that you have not verified in the codebase. Collect concrete evidence as you go: file paths, numbers, benchmark output. This evidence becomes the content you cite in blocks.

### Phase 2: Content planning

Structure the document into numbered sections. Choose block types deliberately: a `table` for enumerable facts, a `compare` for two-sided tradeoffs, a `stat` row for headline numbers, `seq`, `state`, or `layers` for flows and structures, `chart` blocks (`heatmap`, `histogram`, `scatter`) or `plot3d` only when the data genuinely needs them. Write the decisions last so the options reflect what the research actually found. Each decision needs two or more options with honest `detail` text, a `why` recommendation, and optionally a comparison table (`cmp`) or a diagram (`dia`).

## Payload shape

A minimal valid payload has a `meta` object with at least a `title`, at least one section with at least one block, and a `decisions` array (which may be empty). Each decision requires `id`, `q`, `multi`, and at least two `opts`; each option requires `id` and `label`, with `detail` optional. Set `multi` to `false` for either-or choices and `true` when several options can be combined.

```json
{
  "meta": { "title": "Add rate limiting to /api/session" },
  "sections": [
    {
      "id": "overview",
      "no": 1,
      "title": "Overview",
      "blocks": [
        { "type": "p", "text": "This document proposes rate limiting for the session endpoint." },
        { "type": "stat", "items": [{ "label": "Requests per minute", "value": "10" }] }
      ]
    }
  ],
  "decisions": [
    {
      "id": "limiter-choice",
      "q": "Which rate limiter should we use?",
      "multi": false,
      "opts": [
        { "id": "cf-ratelimit", "label": "Cloudflare Rate Limiting binding" },
        { "id": "custom-kv", "label": "Custom KV counter" }
      ]
    }
  ]
}
```

The full schema is the `payloadSchema` Zod export in `packages/schema/src/payload.ts` of the ENEmyr/brief repository. The API rejects invalid payloads with a 400 listing the failing paths.

## Block type reference

| Type | Purpose |
| --- | --- |
| `p` | A paragraph of body text. |
| `note` | An informational callout with optional title. |
| `warn` | A warning callout with optional title. |
| `good` | A positive or success callout with optional title. |
| `table` | A data table with a header row, string cell rows, and optional caption. |
| `compare` | A two-sided comparison; each side has a title, an optional good or bad tone, and items marked ok or not ok. |
| `stat` | A row of stat tiles, each with a label, a value, and optional hint and color tone. |
| `coverage` | A checklist of items, each marked full, partial, or missing, with optional notes. |
| `details` | A collapsible disclosure wrapping other blocks (any type except another `details`). |
| `seq` | An interactive sequence diagram from a list of actors and labeled steps. |
| `state` | An interactive state machine from states, transitions, and an initial state. |
| `layers` | A layered architecture diagram; each layer owns nodes and edges. |
| `ba` | A before and after code comparison in one language. |
| `bigo` | A complexity growth chart plotting named curves (constant through exponential). |
| `code` | Syntax-highlighted code with optional filename and highlighted line numbers. |
| `mermaid` | A raw Mermaid diagram, rendered client side. |
| `math` | LaTeX math rendered with KaTeX. |
| `erd` | An entity relationship diagram from table and column definitions. |
| `heatmap` | A two-dimensional value grid with x and y labels. |
| `histogram` | A bar chart of labeled bins and counts. |
| `scatter` | A scatter plot with one or more labeled point series. |
| `plot3d` | A 3D scatter or surface plot. |

## Publishing

POST the payload, wrapped in a `payload` key, to the API:

```bash
curl -X POST https://brief-api.algoryth.me/api/session \
  -H 'content-type: application/json' \
  -d '{ "payload": { "meta": { "title": "..." }, "sections": [ ... ], "decisions": [ ... ] } }'
```

A successful response is `201` with:

```json
{ "id": "aB3xYz01qWe9rT", "url": "https://brief.algoryth.me/s/aB3xYz01qWe9rT" }
```

Return the `url` to the human and keep the `id`. The agent can later re-read the published document as markdown from `https://brief-api.algoryth.me/api/session/<id>/raw`; the raw export contains only the payload, not the reader's annotations or answers. Protected sessions return 403 on the raw endpoint.

## Limits and semantics

- The serialized payload JSON must stay under 1,900,000 bytes; the API returns 413 above that.
- Session creation is rate limited to 10 requests per minute per IP; exceeding it returns 429.
- Sessions expire 7 days after the last open. If the reader saves the session, the window extends to 90 days, still sliding from the last open.
- The reader may encrypt the session with a password, after which the server holds only ciphertext and the raw endpoint returns 403. Never rely on being able to re-read a session later; keep your own copy of the payload if you need continued access.
- The reader replies by copying a generated prompt back into the agent conversation: decision answers arrive as a summary prompt, and annotations arrive as pasted prompts referencing the session. Design the decisions and asks around that loop, so each question is one the human can settle from the document alone.

## Writing rules for the document

- Verified facts only. Every number, path, and claim in the payload must come from the research phase.
- Cite file paths in prose so the reader can check the evidence.
- Keep sections focused; one topic per section, in reading order.
- Use plain language. The payload is rendered to humans; no emoji in payload text either.
