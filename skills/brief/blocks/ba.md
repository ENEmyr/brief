# `ba`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"ba"` |
| `language` | yes | `label` |
| `before` | yes | string (may be `""`) |
| `after` | yes | string (may be `""`) |
| `titleBefore` | no | `label` |
| `titleAfter` | no | `label` |
| `filename` | no | `label`, file both sides from |
| `notes` | no | array of ba note objects, max 30 |

Both sides share one language.

Ba note object = `code` note plus `side`:

| Field | Required | Type |
| --- | --- | --- |
| `side` | yes | `"before"` or `"after"`, side line numbers count in |
| `from` | yes | `position`, first noted line of that side |
| `to` | no | `position`, last noted line; absent = note covers `from` only |
| `text` | yes | string, 1 to 280 chars |

Count lines in named side, from 1. Note with `to` before `from`, or lines past end of side, dropped silently, no error. Check each range against string you wrote.

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
