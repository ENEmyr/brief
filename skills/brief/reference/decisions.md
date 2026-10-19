# Decisions

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
