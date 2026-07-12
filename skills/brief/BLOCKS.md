# Block reference

Every field below is transcribed from `payloadSchema` in `packages/schema/src/payload.ts` of the ENEmyr/brief repository. If a field is not listed here, the API rejects it only when it breaks a listed rule; unknown extra keys are stripped, not honoured, so do not invent fields.

## Shared constraints

These two string rules are referenced throughout the tables.

- `label`: a string of 1 to 300 characters. Used for titles, ids, captions, axis names, and any short piece of text.
- `text`: a string of at least 1 character, with no upper bound. Used for prose.

Two more rules that catch agents out:

- A section requires `id`, `no`, `title`, and at least one block. `no` is an integer of 1 or more and is what the reader sees as the section number.
- Every block is discriminated on `type`. A misspelled `type` fails validation with `sections.N.blocks.M: Invalid discriminator value`.

## Choosing a block

| You have | Use | Not |
| --- | --- | --- |
| An argument or explanation in prose | `p` | A `note` for every paragraph. Callouts lose their weight when everything is one. |
| A caveat the reader must not miss | `warn` | A `p` starting with "Warning:". |
| An aside the reader can skip | `note` | `warn`, which signals risk. |
| A result worth celebrating, or a passing check | `good` | `stat`, which is for numbers. |
| Enumerable facts with the same shape | `table` | Several `p` blocks with bullet-like prose. |
| Two competing options, item by item | `compare` | A two-column `table`, which cannot show the ok or not-ok verdict per item. |
| Two or three headline numbers | `stat` | A one-row `table`. |
| What is covered, partly covered, and missing | `coverage` | A `table` with a "Status" column. |
| Long evidence that supports a claim but interrupts reading | `details` | Cutting the evidence. |
| A message exchange over time between named parties | `seq` | `mermaid` with a `sequenceDiagram`, which is not interactive. |
| A machine with states and transitions | `state` | `mermaid` with a `stateDiagram`. |
| An architecture in tiers, with nodes and edges inside each tier | `layers` | `mermaid` with a `flowchart`. |
| A code change, old versus new | `ba` | Two `code` blocks. |
| Algorithmic growth as input size rises | `bigo` | `scatter` with hand-computed points. |
| A snippet the reader should read as code | `code` | A `p` with backticks. |
| A diagram no other block covers (Gantt, class, mindmap, ER variants) | `mermaid` | Forcing the data into `layers` or `seq`. |
| An equation | `math` | A `code` block with LaTeX in it. |
| Tables, columns, keys, and their relationships | `erd` | `mermaid` with `erDiagram`, unless you need an ER feature this block lacks. |
| A value per cell across two labelled axes | `heatmap` | `table` full of numbers. |
| A distribution across bins | `histogram` | `table` of counts. |
| Points in two dimensions, possibly several series | `scatter` | `histogram`. |
| Points or a surface in three dimensions | `plot3d` | Two `scatter` blocks. |

Prefer the plainest block that carries the fact. A document of twenty diagrams reads as decoration; a document of twenty paragraphs reads as an essay. Most real documents are mostly `p` and `table`, with a handful of the rest where the shape of the data demands it.

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

## Data

### `table`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"table"` |
| `head` | yes | array of `label`, at least 1 |
| `rows` | yes | array of arrays of string, at least 1 row |
| `caption` | no | `label` |

Cells are plain strings, never numbers. Write `"1200"`, not `1200`. Ragged rows are accepted by the schema but render badly; keep every row the same length as `head`.

```json
{
  "type": "table",
  "caption": "Write volume by endpoint, last 7 days",
  "head": ["Endpoint", "Writes", "P95 latency"],
  "rows": [
    ["/api/session", "48,120", "82 ms"],
    ["/api/session/:id/state", "9,004", "31 ms"]
  ]
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

Stat item:

| Field | Required | Type |
| --- | --- | --- |
| `label` | yes | `label` |
| `value` | yes | string (any string, including `""`) |
| `hint` | no | string |
| `tone` | no | one of `mauve`, `blue`, `green`, `red`, `peach`, `teal`, `yellow` |

`tone` is a fixed palette. Any other colour name fails validation. Values are strings: `"82 ms"`, `"48,120"`, `"3.2x"`.

```json
{
  "type": "stat",
  "items": [
    { "label": "Requests per minute", "value": "10", "hint": "Per IP, current limit", "tone": "blue" },
    { "label": "P95 latency", "value": "82 ms", "tone": "green" },
    { "label": "Unbounded endpoints", "value": "3", "tone": "red" }
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
    { "label": "Two-phase flush", "status": "partial", "note": "Happy path only; no test for a crash between phases." },
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
| `label` | yes | string (may be `""`) |
| `note` | no | string |

```json
{
  "type": "seq",
  "title": "Session publish",
  "actors": ["Agent", "Ingest API", "D1"],
  "steps": [
    { "from": "Agent", "to": "Ingest API", "label": "POST /api/session" },
    { "from": "Ingest API", "to": "D1", "label": "INSERT session", "note": "Payload stored as a JSON string." },
    { "from": "Ingest API", "to": "Agent", "label": "201 { id, url }" }
  ]
}
```

### `state`

`initial` and every `from` and `to` must match a state `id`, not a state `label`.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"state"` |
| `initial` | yes | `label`, must match a state `id` |
| `states` | yes | array of `{ id: label, label: label }`, at least 1 |
| `transitions` | yes | array of `{ from: label, to: label, label?: string }`, may be empty |
| `title` | no | `label` |

```json
{
  "type": "state",
  "title": "Session lifecycle",
  "initial": "draft",
  "states": [
    { "id": "draft", "label": "Draft" },
    { "id": "published", "label": "Published" },
    { "id": "expired", "label": "Expired" }
  ],
  "transitions": [
    { "from": "draft", "to": "published", "label": "POST /api/session" },
    { "from": "published", "to": "expired", "label": "7 days without an open" }
  ]
}
```

### `layers`

Edges live inside a layer, so an edge connects nodes within that same layer.

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
| `nodes` | yes | array of `{ id: label, label: label }`, at least 1 |
| `edges` | yes | array of `{ from: label, to: label, label?: string }`, may be empty |

```json
{
  "type": "layers",
  "title": "Tracker architecture",
  "layers": [
    {
      "id": "client",
      "label": "Developer machine",
      "nodes": [
        { "id": "hook", "label": "Tracker hook" },
        { "id": "buffer", "label": "Local buffer" }
      ],
      "edges": [{ "from": "hook", "to": "buffer", "label": "append" }]
    },
    {
      "id": "edge",
      "label": "Cloudflare",
      "nodes": [
        { "id": "ingest", "label": "Ingest API" },
        { "id": "d1", "label": "D1" }
      ],
      "edges": [{ "from": "ingest", "to": "d1", "label": "Drizzle" }]
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

Both sides share one language.

```json
{
  "type": "ba",
  "language": "ts",
  "titleBefore": "Today",
  "titleAfter": "Proposed",
  "before": "app.post('/api/session', handler)",
  "after": "app.post('/api/session', rateLimit(10), handler)"
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

```json
{
  "type": "code",
  "language": "ts",
  "filename": "apps/api/src/features/session/index.ts",
  "highlight": [3],
  "code": "const { success } = await env.RATE_LIMITER.limit({ key: `create:${ip}` })\nif (!success) {\n  set.status = 429\n}"
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

```json
{
  "type": "histogram",
  "title": "Session duration",
  "bins": [
    { "label": "0-5 min", "count": 42 },
    { "label": "5-15 min", "count": 88 },
    { "label": "15+ min", "count": 17 }
  ]
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

## Decisions

A decision is not a block. Decisions live in the top-level `decisions` array, and the reader answers them in a stepper at the end of the document.

| Field | Required | Type |
| --- | --- | --- |
| `id` | yes | `label`, unique across the document; it appears verbatim in the reader's reply |
| `q` | yes | `text`, the question |
| `multi` | yes | boolean; `false` for either-or, `true` when options can be combined |
| `opts` | yes | array of option objects, at least 2 |
| `why` | no | string; your recommendation, shown in an "Explanation" tab |
| `cmp` | no | a table **without** its `type` field: `{ head, rows, caption? }`; shown in a "Compare" tab |
| `dia` | no | string; see below |

Option object:

| Field | Required | Type |
| --- | --- | --- |
| `id` | yes | `label`, unique within the decision |
| `label` | yes | `label`, the option as the reader sees it |
| `detail` | no | string, the honest tradeoff |

Two fields that agents routinely get wrong:

- `cmp` is a `table` block with the `type` key removed. Including `"type": "table"` inside `cmp` fails validation.
- `dia` is a plain **string label**, not a diagram specification. The reader renders it literally as `[diagram: <your string>]` (`apps/web/src/features/decisions/components/SupportTabs.tsx`). Putting Mermaid source in it produces a line of visible Mermaid source. If a decision needs a real diagram, put a `seq`, `state`, `layers`, or `mermaid` block in the section that sets the decision up, and leave `dia` out.

```json
{
  "id": "limiter-choice",
  "q": "Which rate limiter should we use for /api/session?",
  "multi": false,
  "why": "The binding costs nothing to run and covers the abuse case we actually saw. The KV counter only pays off if we later need per-user quotas, which nothing in the current roadmap asks for.",
  "opts": [
    {
      "id": "cf-binding",
      "label": "Cloudflare Rate Limiting binding",
      "detail": "Ships today, no storage cost, but the key space is limited to what the binding exposes, so per-user quotas are out."
    },
    {
      "id": "custom-kv",
      "label": "Custom KV counter",
      "detail": "Any key space we want, at one KV write per request and an eventual-consistency window that lets a burst through."
    }
  ],
  "cmp": {
    "head": ["Criterion", "CF binding", "KV counter"],
    "rows": [
      ["Cost per request", "None", "1 KV write"],
      ["Per-user quotas", "No", "Yes"],
      ["Time to ship", "Hours", "Days"]
    ]
  }
}
```
