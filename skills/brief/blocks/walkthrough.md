# `walkthrough`

Listing beside flowchart of what it does. Each step claims run of code lines, lights flowchart nodes those lines run, so reader steps code + flow together. Use to explain how one function or handler works. Plain listing -> `code`; flow with no code -> `mermaid`.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"walkthrough"` |
| `language` | yes | `label`, e.g. `"ts"` or `"python"` |
| `code` | yes | string, 1 to 20000 chars |
| `flow` | yes | object `{ nodes, edges }` |
| `flow.nodes` | yes | array of 2 to 40 `{ id: label, label: label, kind?, tone? }` |
| `flow.nodes[].kind` | no | one of `start`, `step`, `decision`, `end` |
| `flow.nodes[].tone` | no | one of `info`, `good`, `warn`, `bad`. Colors `step` or `end` node; `start` and `decision` nodes ignore it. |
| `flow.edges` | yes | array of max 80 `{ from: label, to: label, label?: label, tone? }`; `from` and `to` are node `id` values. Send `[]` for no edges. |
| `flow.edges[].tone` | no | one of `info`, `good`, `warn`, `bad`. Colors edge + its label, e.g. `bad` on failing branch, `good` on passing one. |
| `steps` | yes | array of 1 to 40 `{ from: position, to?: position, title: label, nodes }` |
| `steps[].from`, `steps[].to` | `from` yes, `to` no | `position`, code lines counted from 1. No `to` -> step claims one line `from`. |
| `steps[].nodes` | yes | array of 1 to 40 node `id` values step lights up |
| `filename` | no | `label` |
| `title` | no | `label` |

Reader lays flow out from `start` node down page. No `tone` -> edge drawn faint, `end` node green; so leave `tone` off flow with no good/bad branch. Step lines past listing end clamped to it. Two steps claim same line -> first step keeps it. Node id, edge end, or step node not defined in flow dropped silently, no error - check each id against `flow.nodes`.

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
      { "id": "deny", "label": "Answer 429", "kind": "end", "tone": "bad" },
      { "id": "pass", "label": "Run the handler", "kind": "end", "tone": "good" }
    ],
    "edges": [
      { "from": "in", "to": "check" },
      { "from": "check", "to": "deny", "label": "no", "tone": "bad" },
      { "from": "check", "to": "pass", "label": "yes", "tone": "good" }
    ]
  },
  "steps": [
    { "from": 1, "title": "Ask the limiter about this client", "nodes": ["in", "check"] },
    { "from": 2, "to": 4, "title": "Refuse a client over the limit", "nodes": ["deny"] },
    { "from": 5, "title": "Let the rest through", "nodes": ["pass"] }
  ]
}
```
