# `layers`

Reader draws all layers at once, one band per layer top to bottom, label top left. Edge may join any two nodes in block. Node repeated in later layer keeps first position. Edge to id no layer defines -> dropped.

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

`diffNode` names the `id` of a node in a `diff` block's `map.nodes` in the same document. When that map node has `status` `added` or `modified`, reader draws a badge on this node; `deleted`, or an id that matches no map node, draws nothing. Omit `diffNode` when the document has no `diff` block with a `map`.

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
