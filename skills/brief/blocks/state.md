# `state`

`initial`, every `from`, every `to` must match state `id`, not state `label`.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"state"` |
| `initial` | yes | `label`, must match state `id` |
| `states` | yes | array of `{ id: label, label: label, tone?: tone }`, min 1 |
| `transitions` | yes | array of `{ from: label, to: label, label?: string, tone?: tone }`, may be empty |
| `title` | no | `label` |

`tone` is one of `info`, `good`, `warn`, `bad`, on state or transition. Use for meaning: `bad` on failure state, `warn` on retry path. Normal path gets no tone, so marked parts stand out.

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
