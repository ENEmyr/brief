# Block reference

Every field below is transcribed from `payloadSchema` in `packages/schema/src/payload.ts` of the ENEmyr/brief repository. If a field is not listed here, the API rejects it only when it breaks a listed rule; unknown extra keys are stripped, not honoured, so do not invent fields.

## Shared constraints

These two string rules are referenced throughout the tables.

- `label`: a string of 1 to 300 characters. Used for titles, ids, captions, axis names, and any short piece of text.
- `text`: a string of at least 1 character, with no upper bound. Used for prose.
- `short`: a string of 1 to 40 characters. Used for the histogram threshold.
- `position`: an integer of 1 or more. Line numbers, table rows and columns, and histogram bins all count from 1.

Two colour vocabularies exist, and they do not mix:

- `tone`: one of `info`, `good`, `warn`, `bad`. It is the meaning of a colour, and table cells, states, and transitions take it.
- stat tone: one of `mauve`, `blue`, `green`, `red`, `peach`, `teal`, `yellow`. It is a palette colour, and only stat tiles take it.

`"tone": "red"` on a table cell fails validation, and so does `"tone": "bad"` on a stat tile.

Two more rules that catch agents out:

- A section requires `id`, `no`, `title`, and at least one block. `no` is an integer of 1 or more and is what the reader sees as the section number.
- Every block is discriminated on `type`. A misspelled `type` fails validation with `sections.N.blocks.M: Invalid discriminator value`.

## Text and callouts

### `p`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"p"` |
| `text` | yes | `text` |

```json
{ "type": "p", "text": "The session endpoint has no rate limit today, so a single client can exhaust the D1 write quota." }
```

### `note`, `warn`, `good`

Same three fields for all three types. `note` is informational, `warn` signals risk, `good` signals a positive result.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"note"`, `"warn"`, or `"good"` |
| `text` | yes | `text` |
| `title` | no | `label` |

```json
{ "type": "warn", "title": "Quota risk", "text": "At 200 requests per second the free D1 tier throttles within four minutes." }
```

### `list`

A bulleted or numbered list of short items. Use it when each item is one phrase or one step with nothing else to compare. When the items carry two or more attributes, such as a severity and an owner, use a `table` with one row per item.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"list"` |
| `items` | yes | array of strings of 1 to 500 characters, 1 to 100 items |
| `ordered` | no | boolean; `true` numbers the items, `false` or absent draws bullets |
| `caption` | no | `label` |

Set `ordered` to `true` only when the order matters, such as steps to follow. Items cannot nest.

```json
{
  "type": "list",
  "ordered": true,
  "caption": "Steps to turn the limit on",
  "items": [
    "Add the rate limiter binding to the API configuration.",
    "Deploy the API.",
    "Send eleven requests in one minute and check that the last one gets a 429."
  ]
}
```

### `image`

A picture the agent uploaded first, such as a screenshot of a bug or a chart from another tool. The block holds only the id that the image API returned, never a URL, a path, or inline data. Upload the file with `POST /api/image` before you create the brief, as "Uploading an image" in `SKILL.md` says.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"image"` |
| `imageId` | yes | string matching `^[\w-]{8,64}$`: 8 to 64 letters, digits, `_`, or `-`. Use the `imageId` from the upload response as it is. A URL or a file path fails validation. |
| `alt` | yes | `label`, what the image shows, for a reader who cannot see it |
| `caption` | no | `label` |
| `width` | no | integer from 1 to 10000, the width in pixels |
| `height` | no | integer from 1 to 10000, the height in pixels |

Give `width` and `height` together: only then does the reader reserve the box before the image loads. If the id is unknown, was never linked, or has expired, the brief still publishes and the block shows "Image is missing or has expired."

```json
{
  "type": "image",
  "imageId": "Vb7kQ2nR9xLm4TzA",
  "alt": "The error page a client sees after its eleventh request in one minute",
  "caption": "429 page in production",
  "width": 1280,
  "height": 720
}
```

## Data

### `table`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"table"` |
| `head` | yes | array of `label`, at least 1 |
| `rows` | yes | array of arrays of string, at least 1 row |
| `caption` | no | `label` |
| `align` | no | array of `left`, `center`, or `right`, at most 50; entry N aligns column N |
| `cells` | no | array of `{ row: position, col: position, tone: tone }`, at most 200 |

Cells are plain strings, never numbers. Write `"1200"`, not `1200`. Ragged rows are accepted by the schema but render badly; keep every row the same length as `head`.

Keep each cell to a phrase; the validator hints at a cell over 200 characters. Make the `caption` say what the table shows, not which file the numbers came from.

`align` lists one alignment per column, from the first column. A column with no entry is left aligned, so `["left", "right"]` right-aligns only the second column. Right-align columns of numbers.

`cells` colours single cells with a `tone`: `info`, `good`, `warn`, or `bad`. `row` and `col` count from 1, and `row` counts the body rows only: `row: 1` is the first array in `rows`, never the header. A position outside the table is ignored without an error. Colour the cells that carry the verdict, such as a failed check, not whole rows.

```json
{
  "type": "table",
  "caption": "Write volume by endpoint, last 7 days",
  "head": ["Endpoint", "Writes", "P95 latency"],
  "align": ["left", "right", "right"],
  "rows": [
    ["/api/session", "48,120", "82 ms"],
    ["/api/session/:id/state", "9,004", "31 ms"]
  ],
  "cells": [{ "row": 1, "col": 3, "tone": "warn" }]
}
```

### `compare`

Two sides, each with its own items. Each item carries `ok`, which renders as a positive or negative mark, so one side can legitimately hold a mix.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"compare"` |
| `left` | yes | side object |
| `right` | yes | side object |
| `caption` | no | `label` |

Side object:

| Field | Required | Type |
| --- | --- | --- |
| `title` | yes | `label` |
| `items` | yes | array of `{ text: text, ok: boolean }`, at least 1 |
| `tone` | no | `"good"` or `"bad"` |
| `tag` | no | `label` |

```json
{
  "type": "compare",
  "caption": "Rate limiter options",
  "left": {
    "title": "Cloudflare Rate Limiting binding",
    "tone": "good",
    "tag": "Recommended",
    "items": [
      { "text": "No extra storage cost", "ok": true },
      { "text": "Cannot express per-user quotas", "ok": false }
    ]
  },
  "right": {
    "title": "Custom KV counter",
    "tone": "bad",
    "items": [
      { "text": "Full control over the key space", "ok": true },
      { "text": "One KV write per request", "ok": false }
    ]
  }
}
```

### `stat`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"stat"` |
| `items` | yes | array of stat items, at least 1 |
| `caption` | no | `label`, one line about the whole row of tiles |

Stat item:

| Field | Required | Type |
| --- | --- | --- |
| `label` | yes | `label` |
| `value` | yes | string (any string, including `""`) |
| `hint` | no | string |
| `tone` | no | stat tone: one of `mauve`, `blue`, `green`, `red`, `peach`, `teal`, `yellow` |
| `hintTone` | no | stat tone, the colour of the `hint` text |
| `spark` | no | array of 2 to 32 numbers, each 0 or more |

`tone` and `hintTone` take the stat palette only. `info`, `good`, `warn`, and `bad` fail here, as does any other colour name. Values are strings: `"82 ms"`, `"48,120"`, `"3.2x"`.

`spark` draws the values as small bars in the tile, from left to right, and marks the highest bar. List the oldest value first. Give it the real series behind `value`, such as the last seven daily counts; a tile with no history has no `spark`. Negative numbers fail validation. Use `hintTone` when the hint is the verdict, such as `"+12% since last week"` in `red`.

A tile holds a number and a few words. Keep `label` and `hint` short; the validator hints at either one over 50 characters. Qualifiers such as how the number was measured go in the paragraph beside the tile.

```json
{
  "type": "stat",
  "caption": "Session endpoint, last 7 days",
  "items": [
    { "label": "Requests per minute", "value": "10", "hint": "Per IP, current limit", "tone": "blue" },
    { "label": "P95 latency", "value": "82 ms", "tone": "green", "spark": [96, 91, 88, 85, 84, 82, 82] },
    { "label": "Unbounded endpoints", "value": "3", "tone": "red", "hint": "Up from 1", "hintTone": "red" }
  ]
}
```

### `coverage`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"coverage"` |
| `items` | yes | array of coverage items, at least 1 |
| `caption` | no | `label` |

Coverage item:

| Field | Required | Type |
| --- | --- | --- |
| `label` | yes | `label` |
| `status` | yes | one of `full`, `partial`, `missing` |
| `note` | no | string |

```json
{
  "type": "coverage",
  "caption": "Test coverage of the flush path",
  "items": [
    { "label": "Buffer write", "status": "full" },
    { "label": "Two-phase flush", "status": "partial", "note": "Only the normal case is tested. No test covers a crash between phases." },
    { "label": "Token revocation", "status": "missing" }
  ]
}
```

### `details`

A collapsible disclosure. Its `blocks` array holds any block type except another `details`; nesting a `details` inside a `details` fails validation.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"details"` |
| `summary` | yes | `label` |
| `blocks` | yes | array of non-`details` blocks, at least 1 |

```json
{
  "type": "details",
  "summary": "Raw wrangler tail output (12 lines)",
  "blocks": [
    { "type": "code", "language": "text", "code": "POST /api/session 201 82ms\nPOST /api/session 429 4ms" }
  ]
}
```

## Diagrams

### `seq`

An interactive sequence diagram. Every `from` and `to` must be a string that appears in `actors`, or the step renders against nothing.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"seq"` |
| `actors` | yes | array of `label`, at least 2 |
| `steps` | yes | array of step objects, at least 1 |
| `title` | no | `label` |

Step object:

| Field | Required | Type |
| --- | --- | --- |
| `from` | yes | `label`, must match an actor |
| `to` | yes | `label`, must match an actor |
| `label` | yes | string (may be `""`), drawn on the arrow |
| `note` | no | string |
| `text` | no | `label`, the step as a sentence in the step list |

The reader also shows the steps as a list of sentences. Without `text`, that list shows the step as its `from`, an arrow, its `to`, and its `label`. Set `text` to say what the step does in plain words, such as "The API stores the document". Keep `label` short, because it sits on the arrow.

```json
{
  "type": "seq",
  "title": "Session publish",
  "actors": ["Agent", "Ingest API", "D1"],
  "steps": [
    { "from": "Agent", "to": "Ingest API", "label": "POST /api/session", "text": "The agent sends the document." },
    { "from": "Ingest API", "to": "D1", "label": "INSERT session", "note": "Payload stored as a JSON string.", "text": "The API stores it." },
    { "from": "Ingest API", "to": "Agent", "label": "201 { id, url }", "text": "The API returns the link." }
  ]
}
```

### `state`

`initial` and every `from` and `to` must match a state `id`, not a state `label`.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"state"` |
| `initial` | yes | `label`, must match a state `id` |
| `states` | yes | array of `{ id: label, label: label, tone?: tone }`, at least 1 |
| `transitions` | yes | array of `{ from: label, to: label, label?: string, tone?: tone }`, may be empty |
| `title` | no | `label` |

`tone` is one of `info`, `good`, `warn`, `bad`, on a state or on a transition. Use it for the meaning, such as `bad` on a failure state or `warn` on a retry path. Leave the normal path without a tone, so the marked parts stand out.

```json
{
  "type": "state",
  "title": "Session lifecycle",
  "initial": "draft",
  "states": [
    { "id": "draft", "label": "Draft" },
    { "id": "published", "label": "Published", "tone": "good" },
    { "id": "expired", "label": "Expired", "tone": "bad" }
  ],
  "transitions": [
    { "from": "draft", "to": "published", "label": "POST /api/session" },
    { "from": "published", "to": "expired", "label": "7 days without an open", "tone": "warn" }
  ]
}
```

### `layers`

The reader draws every layer at once, one band per layer from top to bottom, with the layer's label at the top left. An edge may join any two nodes in the block. A node repeated in a later layer keeps its first position, and an edge to an id that no layer defines is dropped.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"layers"` |
| `layers` | yes | array of layer objects, at least 1 |
| `title` | no | `label` |

Layer object:

| Field | Required | Type |
| --- | --- | --- |
| `id` | yes | `label` |
| `label` | yes | `label` |
| `nodes` | yes | array of `{ id: label, label: label, diffNode?: label }`, at least 1 |
| `edges` | yes | array of `{ from: label, to: label, label?: string }`, may be empty |

`diffNode` links a node to a node of a diff block, so the node can carry that change's badge. No diff block exists in this version of Brief, so the reader shows nothing for it. Leave it out.

```json
{
  "type": "layers",
  "title": "Session create path",
  "layers": [
    {
      "id": "base",
      "label": "Request path",
      "nodes": [
        { "id": "client", "label": "Client" },
        { "id": "ingest", "label": "Ingest API" },
        { "id": "d1", "label": "D1" }
      ],
      "edges": [
        { "from": "client", "to": "ingest", "label": "POST /api/session" },
        { "from": "ingest", "to": "d1", "label": "INSERT" }
      ]
    },
    {
      "id": "limit",
      "label": "Rate limiting",
      "nodes": [{ "id": "limiter", "label": "RATE_LIMITER" }],
      "edges": [{ "from": "ingest", "to": "limiter", "label": "limit(ip)" }]
    }
  ]
}
```

### `erd`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"erd"` |
| `tables` | yes | array of table objects, at least 1 |
| `title` | no | `label` |

Table object:

| Field | Required | Type |
| --- | --- | --- |
| `name` | yes | `label` |
| `columns` | yes | array of column objects, at least 1 |

Column object:

| Field | Required | Type |
| --- | --- | --- |
| `name` | yes | `label` |
| `type` | yes | `label`, free text such as `"text"` or `"integer"` |
| `pk` | no | boolean |
| `fk` | no | `{ table: label, column: label }` |

```json
{
  "type": "erd",
  "tables": [
    {
      "name": "sessions",
      "columns": [
        { "name": "id", "type": "text", "pk": true },
        { "name": "payload", "type": "text" }
      ]
    },
    {
      "name": "annotations",
      "columns": [
        { "name": "id", "type": "text", "pk": true },
        { "name": "session_id", "type": "text", "fk": { "table": "sessions", "column": "id" } }
      ]
    }
  ]
}
```

### `mermaid`

Rendered client side, so an invalid Mermaid body passes the API and fails in the reader's browser. Use a named block instead where one exists.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"mermaid"` |
| `code` | yes | string, at least 1 character |
| `title` | no | `label` |

```json
{ "type": "mermaid", "title": "Rollout", "code": "gantt\n  title Rollout\n  section Phase 1\n  Shadow mode :a1, 2026-07-14, 5d" }
```

## Code and math

### `ba`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"ba"` |
| `language` | yes | `label` |
| `before` | yes | string (may be `""`) |
| `after` | yes | string (may be `""`) |
| `titleBefore` | no | `label` |
| `titleAfter` | no | `label` |
| `filename` | no | `label`, the file both sides come from |
| `notes` | no | array of ba note objects, at most 30 |

Both sides share one language.

Ba note object, the same as a `code` note plus `side`:

| Field | Required | Type |
| --- | --- | --- |
| `side` | yes | `"before"` or `"after"`, the side the line numbers count in |
| `from` | yes | `position`, the first noted line of that side |
| `to` | no | `position`, the last noted line; absent means the note covers `from` only |
| `text` | yes | string of 1 to 280 characters |

Count lines in the side the note names, from 1. A note whose `to` is before its `from`, or whose lines run past the end of its side, is dropped without an error, so check each range against the string you wrote.

```json
{
  "type": "ba",
  "language": "ts",
  "filename": "apps/api/src/index.ts",
  "titleBefore": "Today",
  "titleAfter": "Proposed",
  "before": "app.post('/api/session', handler)",
  "after": "app.post('/api/session', rateLimit(10), handler)",
  "notes": [{ "side": "after", "from": 1, "text": "Ten creations per minute for each IP address." }]
}
```

### `code`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"code"` |
| `language` | yes | `label` |
| `code` | yes | string (may be `""`) |
| `filename` | no | `label` |
| `highlight` | no | array of integers of 1 or more, 1-indexed line numbers |
| `notes` | no | array of code note objects, at most 30 |

Code note object:

| Field | Required | Type |
| --- | --- | --- |
| `from` | yes | `position`, the first noted line |
| `to` | no | `position`, the last noted line; absent means the note covers `from` only |
| `text` | yes | string of 1 to 280 characters |

A note is your comment on a line or a range of lines. The reader marks the last line of the range, shows the note when the reader points at the mark, and pins it under the line on a click. Line numbers count from 1, the same as `highlight`. A note whose `to` is before its `from`, or whose lines run past the last line of `code`, is dropped without an error. Count the lines of the `code` string after you write it, including blank lines. Never put a secret, a credential, or personal data in a note. Every reader of the document sees it.

```json
{
  "type": "code",
  "language": "ts",
  "filename": "apps/api/src/features/session/index.ts",
  "highlight": [3],
  "code": "const { success } = await env.RATE_LIMITER.limit({ key: `create:${ip}` })\nif (!success) {\n  set.status = 429\n}",
  "notes": [
    { "from": 1, "text": "The key is the client IP, so one client cannot use up the limit of another." },
    { "from": 2, "to": 4, "text": "The request stops here with a 429 when the limit is reached." }
  ]
}
```

### `math`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"math"` |
| `latex` | yes | string, at least 1 character |
| `title` | no | `label` |

Rendered with KaTeX. Backslashes must be escaped in JSON: `\\frac`, not `\frac`.

```json
{ "type": "math", "title": "Token bucket refill", "latex": "t_{\\text{wait}} = \\frac{n - b}{r}" }
```

## Charts

### `bigo`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"bigo"` |
| `series` | yes | array of `{ label: label, curve: curve }`, at least 1 |
| `title` | no | `label` |
| `maxN` | no | integer from 10 to 1,000,000 |

`curve` is one of exactly: `1`, `logn`, `sqrt`, `n`, `nlogn`, `n2`, `n3`, `2n`. They are strings, not numbers: `"curve": "n2"`, never `"curve": "O(n^2)"`.

```json
{
  "type": "bigo",
  "title": "Lookup cost as the buffer grows",
  "maxN": 1000,
  "series": [
    { "label": "Current linear scan", "curve": "n" },
    { "label": "Proposed index", "curve": "logn" }
  ]
}
```

### `heatmap`

`values` is row-major: `values[y][x]`. Give it `yLabels.length` rows, each of `xLabels.length` numbers.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"heatmap"` |
| `xLabels` | yes | array of `label`, at least 1 |
| `yLabels` | yes | array of `label`, at least 1 |
| `values` | yes | array of arrays of number, at least 1 row |
| `title` | no | `label` |

```json
{
  "type": "heatmap",
  "title": "Errors by hour and day",
  "xLabels": ["00", "06", "12", "18"],
  "yLabels": ["Mon", "Tue"],
  "values": [
    [0, 2, 11, 4],
    [1, 0, 9, 3]
  ]
}
```

### `histogram`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"histogram"` |
| `bins` | yes | array of `{ label: label, count: number }`, at least 1 |
| `title` | no | `label` |
| `threshold` | no | `{ bin: position, label: short, value?: short }` |

`threshold` marks a limit on the chart, such as a timeout or a target. `bin` counts the bins from 1, and the line sits on the left edge of that bin. The reader colours that bin and every bin after it as past the limit. The line shows `label`, followed by `value` when you give one, and each is 1 to 40 characters. A `bin` past the last bin draws no threshold and gives no error. A histogram has one threshold and no separate percentile field. To mark a percentile such as p95, use `threshold` with `"label": "p95"` and the measured value in `value`.

```json
{
  "type": "histogram",
  "title": "Session duration",
  "bins": [
    { "label": "0-5 min", "count": 42 },
    { "label": "5-15 min", "count": 88 },
    { "label": "15+ min", "count": 17 }
  ],
  "threshold": { "bin": 3, "label": "Idle timeout", "value": "15 min" }
}
```

### `scatter`

Each point is a two-number tuple `[x, y]`, not an object. `{ "x": 1, "y": 2 }` fails validation.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"scatter"` |
| `series` | yes | array of `{ label: label, points: [number, number][] }`, at least 1 series, at least 1 point each |
| `title` | no | `label` |
| `xLabel` | no | `label` |
| `yLabel` | no | `label` |

```json
{
  "type": "scatter",
  "title": "Latency against payload size",
  "xLabel": "Payload KB",
  "yLabel": "P95 ms",
  "series": [
    { "label": "Today", "points": [[12, 80], [48, 96], [120, 143]] },
    { "label": "With compression", "points": [[12, 78], [48, 84], [120, 101]] }
  ]
}
```

### `plot3d`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"plot3d"` |
| `kind` | yes | `"scatter3d"` or `"surface"` |
| `points` | no | array of `[number, number, number]` tuples |
| `grid` | no | array of arrays of number |
| `title` | no | `label` |
| `xLabel`, `yLabel`, `zLabel` | no | `label` |

The schema marks both `points` and `grid` optional, so a `plot3d` with neither passes validation and renders empty. Supply `points` for `scatter3d` and `grid` for `surface`.

```json
{
  "type": "plot3d",
  "kind": "scatter3d",
  "title": "Cost against concurrency and payload size",
  "xLabel": "Concurrency",
  "yLabel": "Payload KB",
  "zLabel": "USD per 1k",
  "points": [[1, 12, 0.4], [8, 48, 1.1], [32, 120, 3.7]]
}
```

## Agent work

Three blocks show how the agent did the work: code beside its flowchart, a change set with a note per change, and the run itself as a log.

### `walkthrough`

A listing beside a flowchart of what it does. Each step claims a run of code lines and lights up the flowchart nodes those lines run, so the reader steps through the code and the flow together. Use it to explain how one function or handler works. For a plain listing use `code`; for a flow with no code use `mermaid`.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"walkthrough"` |
| `language` | yes | `label`, such as `"ts"` or `"python"` |
| `code` | yes | string of 1 to 20000 characters |
| `flow` | yes | object `{ nodes, edges }` |
| `flow.nodes` | yes | array of 2 to 40 `{ id: label, label: label, kind? }` |
| `flow.nodes[].kind` | no | one of `start`, `step`, `decision`, `end` |
| `flow.edges` | yes | array of at most 80 `{ from: label, to: label, label?: label }`; `from` and `to` are node `id` values. Send `[]` for no edges. |
| `steps` | yes | array of 1 to 40 `{ from: position, to?: position, title: label, nodes }` |
| `steps[].from`, `steps[].to` | `from` yes, `to` no | `position`, code lines counted from 1. Without `to`, the step claims the one line `from`. |
| `steps[].nodes` | yes | array of 1 to 40 node `id` values that the step lights up |
| `filename` | no | `label` |
| `title` | no | `label` |

The reader lays the flow out from the `start` node down the page. Step lines past the end of the listing are clamped to it, and when two steps claim the same line, the first step keeps it. A node id, an edge end, or a step node that the flow does not define is dropped without an error, so check each id against `flow.nodes`.

```json
{
  "type": "walkthrough",
  "language": "ts",
  "filename": "rateLimit.ts",
  "code": "const { success } = await limiter.limit({ key })\nif (!success) {\n  return reject(429)\n}\nreturn next()",
  "flow": {
    "nodes": [
      { "id": "in", "label": "Request arrives", "kind": "start" },
      { "id": "check", "label": "Under the limit?", "kind": "decision" },
      { "id": "deny", "label": "Answer 429", "kind": "end" },
      { "id": "pass", "label": "Run the handler", "kind": "end" }
    ],
    "edges": [
      { "from": "in", "to": "check" },
      { "from": "check", "to": "deny", "label": "no" },
      { "from": "check", "to": "pass", "label": "yes" }
    ]
  },
  "steps": [
    { "from": 1, "title": "Ask the limiter about this client", "nodes": ["in", "check"] },
    { "from": 2, "to": 4, "title": "Refuse a client over the limit", "nodes": ["deny"] },
    { "from": 5, "title": "Let the rest through", "nodes": ["pass"] }
  ]
}
```

### `diff`

A change set, file by file. The semantic view lists each change with the agent's note, and the raw view prints the patch. Use it to review what a change did. For one snippet before and after use `ba`.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"diff"` |
| `files` | yes | array of 1 to 50 files |
| `files[].path` | yes | `label` |
| `files[].status` | yes | one of `added`, `modified`, `deleted`, `renamed` |
| `files[].from` | no | `label`, the old path of a renamed file |
| `files[].patch` | no | string of at most 50000 characters, unified diff text for the raw view |
| `files[].folded` | no | boolean; `true` starts the file folded, with an Unfold button |
| `files[].changes` | no | array of at most 30 changes |
| `changes[].symbol` | yes | `label`, the function, type, or key that changed |
| `changes[].change` | yes | one of `added`, `modified`, `removed`, `moved`, `config` |
| `changes[].summary` | yes | string of 1 to 280 characters, what the change does |
| `changes[].steps` | no | array of at most 8 `label`, the steps of an added function |
| `map` | no | object `{ nodes, edges }`, a change map above the file list |
| `map.nodes` | yes, when `map` is given | array of 1 to 40 `{ id: label, label: label, status? }` |
| `map.nodes[].status` | no | one of `added`, `modified`, `deleted` |
| `map.edges` | yes, when `map` is given | array of at most 80 `{ from: label, to: label }`, node `id` values |

A file's `status` takes `deleted`, while a change's `change` takes `removed`: the two vocabularies differ. A map node with a `status` is marked as changed, and a node that a changed node points to is drawn under it.

```json
{
  "type": "diff",
  "files": [
    {
      "path": "apps/api/src/features/session/index.ts",
      "status": "modified",
      "patch": "@@ -1,2 +1,4 @@\n export async function createSession(request) {\n+  if (await limited(request)) return tooMany()\n   return insert()\n }",
      "changes": [
        { "symbol": "createSession", "change": "modified", "summary": "Checks the rate limiter before it writes the session." }
      ]
    },
    {
      "path": "apps/api/wrangler.jsonc",
      "status": "modified",
      "folded": true,
      "changes": [{ "symbol": "RATE_LIMITER", "change": "config", "summary": "Adds the limiter binding at 10 calls per 60 seconds." }]
    }
  ]
}
```

### `trajectory`

The agent's run as a log: what it was asked, what it read and ran, what it changed, decided, and assumed. The reader shows each step as time since the first step, filters by kind, and lets the reader mark flagged steps; the marks come back in the reply. Use it when how the agent reached the result changes how far to trust it. Do not use it as a dump of every command.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"trajectory"` |
| `steps` | yes | array of 1 to 200 steps |
| `steps[].at` | yes | ISO 8601 date and time in UTC, ending in `Z`, such as `"2026-07-12T09:05:40Z"`. Fractions of a second are allowed. An offset such as `+07:00` fails validation. |
| `steps[].kind` | yes | one of `request`, `read`, `run`, `edit`, `decision`, `assumption`, `note` |
| `steps[].title` | yes | `label` |
| `steps[].detail` | no | string of 1 to 400 characters |
| `steps[].flag` | no | boolean; `true` highlights the step and lets the reader mark it |
| `stats` | no | object `{ seconds?, tokens? }`, each an integer of 0 or more: the run's length and the tokens it used. Without `seconds`, the reader shows the time from the first step to the last. |

Flag the steps the reader should check, such as an assumption the result rests on. The filters are all, decided (`decision`), assumed (`assumption`), edits (`edit`), and reads plus bash (`read` and `run`).

```json
{
  "type": "trajectory",
  "steps": [
    { "at": "2026-07-12T09:00:00Z", "kind": "request", "title": "Check whether one client can flood session creation" },
    { "at": "2026-07-12T09:05:40Z", "kind": "run", "title": "Sent 500 create requests from one address", "detail": "All 500 returned 201." },
    { "at": "2026-07-12T09:08:00Z", "kind": "assumption", "title": "Production traffic comes from many addresses", "flag": true }
  ],
  "stats": { "seconds": 480, "tokens": 38200 }
}
```

## Decisions

A decision is not a block. Decisions live in the top-level `decisions` array, and the reader answers them in the decision dock, not at the end of the document. The array may be empty; the reader then shows no decision area.

| Field | Required | Type |
| --- | --- | --- |
| `id` | yes | `label`, unique across the document; it appears verbatim in the reader's reply |
| `q` | yes | `text`, the question |
| `multi` | yes | boolean; `false` for either-or, `true` when options can be combined |
| `opts` | yes | array of option objects, at least 2 |
| `why` | no | string; your recommendation, shown in an "Explanation" tab |
| `cmp` | no | a table **without** its `type` field: `{ head, rows, caption? }`; shown in a "Compare" tab |
| `dia` | no | string; see below |
| `refs` | no | array of section `id` values, at most 6, each a `label` |

`refs` names the sections that give the reader the context for this decision, in reading order. The reader shows each one as a chip with the section number and title, and a click on a chip scrolls to that section. A ref holds a section `id`, such as `"evidence"`. It never holds a decision id, a section number, or a title. An id that matches no section is dropped without an error, and so is a repeated id.

Option object:

| Field | Required | Type |
| --- | --- | --- |
| `id` | yes | `label`, unique within the decision |
| `label` | yes | `label`, the option as the reader sees it, in words; do not repeat the `id` |
| `detail` | no | string, the honest tradeoff |

Two fields that agents routinely get wrong:

- `cmp` is a `table` block with the `type` key removed. Including `"type": "table"` inside `cmp` fails validation.
- `dia` is a plain **string label**, not a diagram specification. The reader renders it literally as `[diagram: <your string>]` (`apps/web/src/features/decisions/components/SupportTabs.tsx`). Putting Mermaid source in it produces a line of visible Mermaid source. If a decision needs a real diagram, put a `seq`, `state`, `layers`, or `mermaid` block in the section that sets the decision up, and leave `dia` out.

```json
{
  "id": "limiter-choice",
  "q": "Which rate limiter should we use for /api/session?",
  "multi": false,
  "why": "The Cloudflare limiter costs nothing to run and stops the abuse we saw. The KV counter is better only if we need a limit for each user, and the roadmap has no such need.",
  "opts": [
    {
      "id": "cf-binding",
      "label": "Cloudflare Rate Limiting binding",
      "detail": "It takes hours to ship and has no storage cost. It cannot set a limit for each user."
    },
    {
      "id": "custom-kv",
      "label": "Custom KV counter",
      "detail": "It can set a limit for each user. It costs one KV write per request, and a short burst can get through."
    }
  ],
  "cmp": {
    "head": ["Criterion", "CF binding", "KV counter"],
    "rows": [
      ["Cost per request", "None", "1 KV write"],
      ["Per-user quotas", "No", "Yes"],
      ["Time to ship", "Hours", "Days"]
    ]
  },
  "refs": ["evidence", "options"]
}
```

## Glossary

The glossary is not a block either. It is an optional top-level `glossary` array beside `meta`, `sections`, and `decisions`. Each entry explains one term the reader may not know.

| Field | Required | Type |
| --- | --- | --- |
| `term` | yes | `label`, the term as it appears in the text |
| `def` | yes | string of 1 to 400 characters, the definition in plain words |
| `aliases` | no | array of `label`, at most 5, other spellings of the same term |

The array holds at most 60 entries. Leave it out, or send `[]`, when the document has no terms to explain.

How the reader finds a term:

- The match ignores case and takes whole words only. In scripts written without spaces, such as Thai, a term matches inside a longer run of text.
- The reader underlines the first use of each term in each section. Hover, focus, or a tap shows `def`.
- The reader looks for terms only in paragraphs (`p`) and in the title and text of `note`, `warn`, and `good` blocks, including those inside a `details` block. A term inside a table, a list, a stat tile, a diagram, or a code block is not underlined.
- A term in a decision question, an option, or a `why` is not underlined. The term's definition lists that decision as a place that uses the term.
- Each alias matches the same as the term. Use aliases for a plural, an abbreviation, or a second language, such as `["RPS", "requests per second"]`.
- A term inside an inline code run, such as `` `KV` `` in a paragraph, is not underlined.
- When two entries share a spelling, such as a term that is also another entry's alias, the earlier entry in the array wins and the later one never matches that spelling. Keep every term and alias unique.

Write `def` as one or two sentences that stand alone, and do not explain a word the reader already knows. Never put a secret, a credential, or personal data in a term, an alias, or a definition. Every reader of the document sees them.

```json
{
  "term": "Rate limit",
  "def": "The most requests one client can send in a time window. The API rejects the rest with a 429 error.",
  "aliases": ["rate limiting"]
}
```
