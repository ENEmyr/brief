---
name: brief
description: Use when research, analysis, review, or planning work produces findings too large or too visual for chat, such as an architecture walkthrough, an incident review, a migration plan, or a comparison of options. Publishes the work as an interactive document on Brief (https://brief.algoryth.me) that the human reads, annotates, questions, and answers any open decisions in, then replies back into the conversation.
---

# Publish a document to Brief

## Overview

Brief turns a piece of agent work into a web document the human can act on. You POST one JSON payload; the API returns a URL; the human opens it, reads the sections, highlights passages to ask about or change, answers any decision cards, and pastes a generated reply back into this conversation. You then act on that reply.

The payload has exactly three top-level keys: `meta`, `sections`, and `decisions`. Everything the reader sees is built from those.

## When to use

Use it when the work produced more than chat carries well: evidence the reader should see laid out, a flow or structure that prose flattens, numbers worth a chart, or a choice that needs the evidence in front of the reader. A document does not need a decision to be worth publishing. The reader can question or ask for an edit on any passage, so an explanation or a review still gets a reply back.

Do not use it for an answer that fits in a few chat paragraphs, or as a place to dump raw logs and command output.

## Workflow

1. **Research and verify.** Read the real files, trace the real code paths, run the real commands. Every number, path, and claim that reaches the payload must come from something you actually saw. Collect file paths as you go; you will cite them in the prose.
2. **Plan the sections.** One topic per section, in reading order, numbered from 1. When the work ends in a choice, a common shape is the problem, the evidence, the options, and the recommendation.
3. **Pick a block for each kind of content.** Use "Choosing blocks" below to match each finding to the block built for its shape, then read `BLOCKS.md` in this skill directory for that block's exact fields, enum values, and a valid JSON example. It covers all 22 block types.
4. **Add decisions only for choices left open.** A decision belongs where the human owns a choice that the research leaves open and at least two options are real. Write those last, so the options reflect what the research found, each with honest `detail` text and usually a `why` that states your recommendation and its cost. When nothing is left to decide, send `"decisions": []`; the reader then shows no decision area.
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

May be empty, and then the reader shows no decision area. Each decision needs `id`, `q`, `multi`, and at least two `opts`. Set `multi` to `false` for an either-or choice and `true` when several options can be taken together. The full field reference, including the two fields agents habitually get wrong (`cmp` and `dia`), is in `BLOCKS.md`.

## Choosing blocks

A page can show what chat cannot, and the blocks are how. Each one renders a shape of content that prose flattens, and several respond to the reader: `seq` steps through its messages one at a time, `state` lets the reader fire transitions from the current state, `layers` switches optional layers on over a base flow, `erd` tables can be dragged, `details` folds away, and every diagram and chart opens in a pan-and-zoom view. A document of paragraphs alone leaves the reader to build those pictures in their head.

For each section, name the shapes in its content, then take the block built for each shape from the table below. Let the content set the count: one block per shape the section actually contains, and none where a block would only repeat the paragraph beside it. Prose is the glue between blocks, a `p` that says what a block shows and why it matters. A section that is an argument with no other shape stays in paragraphs.

| You have | Use | Not |
| --- | --- | --- |
| An argument or explanation in prose | `p` | A `note` for every paragraph. Callouts lose their weight when everything is one. |
| A caveat the reader must not miss | `warn` | A `p` starting with "Warning:". |
| An aside the reader can skip | `note` | `warn`, which signals risk. |
| A result worth celebrating, or a passing check | `good` | `stat`, which is for numbers. |
| Enumerable facts with the same shape, such as findings with a severity or options across several criteria | `table` | Several `p` blocks with bullet-like prose. |
| Two competing options, item by item | `compare` | A two-column `table`, which cannot show the ok or not-ok verdict per item. |
| Two or three headline numbers | `stat` | A one-row `table`. |
| What is covered, partly covered, and missing | `coverage` | A `table` with a "Status" column. |
| Long evidence that supports a claim but interrupts reading | `details` | Cutting the evidence. Content the reader needs to follow the argument, such as the options being decided, stays outside it. |
| A message exchange over time between named parties | `seq` | `mermaid` with a `sequenceDiagram`, which is not interactive. |
| A machine with states and transitions | `state` | `mermaid` with a `stateDiagram`. |
| A main flow with optional parts the reader switches on, such as a cache or a retry path | `layers` | Several tiers that must all show at once. Only the first layer is visible until the reader toggles the others, so draw those with `mermaid` and a `flowchart`. |
| A code change, old versus new | `ba` | Two `code` blocks. |
| Algorithmic growth as input size rises | `bigo` | `scatter` with hand-computed points. |
| A snippet the reader should read as code | `code` | A `p` with backticks. |
| A diagram no other block covers (a flowchart of components, Gantt, class, mindmap, ER variants) | `mermaid` | Forcing the data into `layers` or `seq`. |
| An equation | `math` | A `code` block with LaTeX in it. |
| Tables, columns, keys, and their relationships | `erd` | `mermaid` with `erDiagram`, unless you need an ER feature this block lacks. |
| A value per cell across two labelled axes | `heatmap` | `table` full of numbers. |
| A distribution across bins | `histogram` | `table` of counts. |
| Points in two dimensions, possibly several series | `scatter` | `histogram`. |
| Points or a surface in three dimensions | `plot3d` | Two `scatter` blocks. |

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

When the document has decisions, design them so this loop closes in one pass. A question the human cannot settle from the document alone is a question that comes back as another round trip.

## Common mistakes

| Mistake | Reality |
| --- | --- |
| Putting Mermaid source in a decision's `dia` | `dia` is a plain string label, rendered literally as `[diagram: <your string>]`. For a real diagram, put a `seq`, `state`, `layers`, or `mermaid` block in the section that sets the decision up. |
| Including `"type": "table"` inside a decision's `cmp` | `cmp` is a table shape with the `type` key removed: `{ head, rows, caption? }`. |
| Numbers in `table.rows` cells | Cells are strings. Write `"48120"`, not `48120`. |
| Nesting a `details` inside a `details` | Rejected by the schema. Flatten it. |
| Explaining a flow, a comparison, or a set of numbers in paragraphs | Use the block built for that shape, and keep the paragraph for what the block cannot say, such as why it matters. |
| A block that repeats the paragraph beside it | Keep whichever carries the fact better and cut the other. |
| Adding a decision so the document has one | `"decisions": []` is a complete document. A decision is for a choice the human owns, with at least two options you would accept. |
| Publishing unverified claims | Every number and path must come from the research phase. A confident wrong document is worse than no document. |
| Retrying a 429 in a loop | Ten creations per minute. Fix the payload offline, then POST once. |
| POSTing without running `validate.mjs` | The script is offline and free; a rejected POST is not. Validate, then publish. |
| Ignoring a warning from `validate.mjs` | A warning is a field the API strips and the reader never sees, such as `color` where the schema says `tone`. The block publishes silently broken. |

## Writing rules for the document

- Verified facts only. Cite file paths in the prose so the reader can check the evidence.
- One topic per section, in reading order.
- Plain language, plain ASCII. No emoji in payload text, and no em-dash or en-dash; use a plain hyphen.
- Honest `detail` on every option. An option with no downside listed reads as a sales pitch, and it costs the reader their trust in the rest of the document.
