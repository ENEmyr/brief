# `state`

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
