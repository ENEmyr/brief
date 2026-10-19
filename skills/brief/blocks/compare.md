# `compare`

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
