# `layers`

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
