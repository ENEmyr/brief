# `walkthrough`

A listing beside a flowchart of what it does. Each step claims a run of code lines and lights up the flowchart nodes those lines run, so the reader steps through the code and the flow together. Use it to explain how one function or handler works. For a plain listing use `code`; for a flow with no code use `mermaid`.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"walkthrough"` |
| `language` | yes | `label`, such as `"ts"` or `"python"` |
| `code` | yes | string of 1 to 20000 characters |
| `flow` | yes | object `{ nodes, edges }` |
| `flow.nodes` | yes | array of 2 to 40 `{ id: label, label: label, kind?, tone? }` |
| `flow.nodes[].kind` | no | one of `start`, `step`, `decision`, `end` |
| `flow.nodes[].tone` | no | one of `info`, `good`, `warn`, `bad`. Colors a `step` or `end` node; `start` and `decision` nodes ignore it. |
| `flow.edges` | yes | array of at most 80 `{ from: label, to: label, label?: label, tone? }`; `from` and `to` are node `id` values. Send `[]` for no edges. |
| `flow.edges[].tone` | no | one of `info`, `good`, `warn`, `bad`. Colors the edge and its label, for example `bad` on the branch that fails and `good` on the one that passes. |
| `steps` | yes | array of 1 to 40 `{ from: position, to?: position, title: label, nodes }` |
| `steps[].from`, `steps[].to` | `from` yes, `to` no | `position`, code lines counted from 1. Without `to`, the step claims the one line `from`. |
| `steps[].nodes` | yes | array of 1 to 40 node `id` values that the step lights up |
| `filename` | no | `label` |
| `title` | no | `label` |

The reader lays the flow out from the `start` node down the page. Without a `tone`, an edge is drawn faint and an `end` node green, so leave `tone` off a flow with no good or bad branch. Step lines past the end of the listing are clamped to it, and when two steps claim the same line, the first step keeps it. A node id, an edge end, or a step node that the flow does not define is dropped without an error, so check each id against `flow.nodes`.

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
