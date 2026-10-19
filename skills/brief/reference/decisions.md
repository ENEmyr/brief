# Decisions

Decision not block. Decisions live in top-level `decisions` array; reader answers them in decision dock, not at document end. Array may be empty; then reader shows no decision area.

| Field | Required | Type |
| --- | --- | --- |
| `id` | yes | `label`, unique across document; appears verbatim in reader's reply |
| `q` | yes | `text`, the question |
| `multi` | yes | boolean; `false` for either-or, `true` when options combine |
| `opts` | yes | array of option objects, min 2 |
| `why` | no | string; your recommendation, shown in "Explanation" tab |
| `cmp` | no | table **without** its `type` field: `{ head, rows, caption? }`; shown in "Compare" tab |
| `dia` | no | string; see below |
| `refs` | no | array of section `id` values, max 6, each a `label` |

`refs` names sections giving reader context for this decision, in reading order. Reader shows each as chip with section number + title; click on chip scrolls to section. Ref holds section `id`, e.g. `"evidence"`. Never decision id, section number, or title. Id matching no section dropped silently; repeated id too.

Option object:

| Field | Required | Type |
| --- | --- | --- |
| `id` | yes | `label`, unique within decision |
| `label` | yes | `label`, option as reader sees it, in words; don't repeat `id` |
| `detail` | no | string, honest tradeoff |

Two fields agents often get wrong:

- `cmp` = `table` block with `type` key removed. Including `"type": "table"` inside `cmp` fails validation.
- `dia` = plain **string label**, not diagram spec. Reader renders literally as `[diagram: <your string>]` in the decision's Diagram tab. Mermaid source in it -> visible line of Mermaid source. Decision needs real diagram -> put `seq`, `state`, `layers`, or `mermaid` block in section that sets up decision, leave `dia` out.

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
