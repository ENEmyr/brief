# `ba`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"ba"` |
| `language` | yes | `label` |
| `before` | yes | string (may be `""`) |
| `after` | yes | string (may be `""`) |
| `titleBefore` | no | `label` |
| `titleAfter` | no | `label` |
| `filename` | no | `label`, the file both sides come from |
| `notes` | no | array of ba note objects, at most 30 |

Both sides share one language.

Ba note object, the same as a `code` note plus `side`:

| Field | Required | Type |
| --- | --- | --- |
| `side` | yes | `"before"` or `"after"`, the side the line numbers count in |
| `from` | yes | `position`, the first noted line of that side |
| `to` | no | `position`, the last noted line; absent means the note covers `from` only |
| `text` | yes | string of 1 to 280 characters |

Count lines in the side the note names, from 1. A note whose `to` is before its `from`, or whose lines run past the end of its side, is dropped without an error, so check each range against the string you wrote.

```json
{
  "type": "ba",
  "language": "ts",
  "filename": "apps/api/src/index.ts",
  "titleBefore": "Today",
  "titleAfter": "Proposed",
  "before": "app.post('/api/session', handler)",
  "after": "app.post('/api/session', rateLimit(10), handler)",
  "notes": [{ "side": "after", "from": 1, "text": "Ten creations per minute for each IP address." }]
}
```
