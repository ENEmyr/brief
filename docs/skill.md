# Publishing to Brief as an agent

This is the human-readable companion to the Brief skill. The skill packages this workflow so a coding agent can publish a decision document with one instruction; the skill itself ships as an installable package, and this document describes what it does and how to author a good payload with or without it.

Install the skill:

```bash
npx skills add ENEmyr/brief
```

Update an installed copy with `npx skills update brief`. The skill carries a generated copy of the payload schema, so an old copy describes old block types; refresh it when this repository adds any.

Once installed, the skill teaches the agent to author a payload, validate it offline against the schema it ships with, POST it to `https://brief-api.algoryth.me/api/session`, and hand the returned URL to the human. Everything the skill does can also be done by hand with the [API reference](api.md).

## Authoring workflow

Author in this order. The payload is immutable once published, so the verification happens before the POST, not after.

1. Research and verify the content first. Read the actual code, run the actual commands, collect the real numbers. A decision document full of guesses wastes the reader's judgment.
2. Structure the material into sections and choose block types. Each section is a numbered top-level division with an id, a title, and an ordered list of blocks. Prefer the specific block over prose: a comparison belongs in a `compare` block, numbers belong in `stat` or `table` blocks, and flows belong in `seq` or `state` blocks.
3. Formulate the decisions. Each decision is a question with at least two options; add `why` context or a comparison table (`cmp`) when the choice is not obvious from the document alone. Note that a decision's `dia` is a plain string label, rendered as `[diagram: <label>]`, and not a diagram specification; a real diagram belongs in a `seq`, `state`, `layers`, or `mermaid` block in the section that sets the decision up.
4. Validate before publishing. The installed skill ships an offline validator, `node <skill-dir>/validate.mjs payload.json`, which reads a copy of the payload schema generated from `packages/schema/src/payload.ts` and reports each failing path. The API also rejects an invalid payload with a 400 listing the failing paths, but it reports at most ten of them and each attempt costs a request against a rate limit of ten per minute.
5. POST the payload and deliver the returned `url` to the human. Keep the `id`; the agent can later re-read the published document as markdown from `/api/session/<id>/raw`. The raw export contains only the payload, not the reader's annotations or answers; those come back to the agent through the reply prompt the reader copies out of the page.

## Block types

The payload supports 22 block types. All of them are defined in `packages/schema/src/payload.ts`, which is the source of truth for their exact fields.

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

## Size limits

The serialized payload JSON must stay under 1,900,000 bytes; the API returns 413 above that. In practice a typical decision document is a few thousand tokens of JSON and nowhere near the cap. If the document may later be password protected by the reader, keep it under about 1.4 MB, because encrypted storage has a lower effective ceiling (see the [API reference](api.md) for the exact caps).

## Decisions and asks

Decisions are the point of the product; a payload without them is just a report. Write each decision as a real question the human must settle, with the options the agent can actually implement. Use `multi: false` for either-or choices and `multi: true` when several options can be combined. Give options a `detail` string when the label alone is ambiguous.

Readers can also raise questions the agent did not anticipate: an Ask is an annotation on a specific text span that exports as a prompt carrying the document URL, the anchor, and the quoted text. Expect asks to arrive as pasted prompts referencing the session, and use `/api/session/<id>/raw` to re-read the document they point into.

## Save and expiry semantics

A published session lives 7 days from its last open, and every open resets the window, so an actively read document does not expire. If the reader saves the session, the window becomes 90 days, still sliding. A daily purge deletes expired sessions permanently; there is no recovery, so an agent that wants durable output should keep its own copy of the payload or re-publish.

The reader may also protect a saved session with a password. A protected session is encrypted end to end in the browser, and the server holds only ciphertext. This matters to agents for one reason: `/api/session/<id>/raw` returns 403 for a protected session, so the agent can no longer re-read it. If the agent needs continued access to the content, it should retain the payload it published.
