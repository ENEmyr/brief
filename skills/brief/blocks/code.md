# `code`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"code"` |
| `language` | yes | `label` |
| `code` | yes | string (may be `""`) |
| `filename` | no | `label` |
| `highlight` | no | array of integers >=1, 1-indexed line numbers |
| `notes` | no | array of code note objects, max 30 |

Code note object:

| Field | Required | Type |
| --- | --- | --- |
| `from` | yes | `position`, first noted line |
| `to` | no | `position`, last noted line; absent = note covers `from` only |
| `text` | yes | string, 1-280 chars |

Note = your comment on one line or line range. Reader marks last line of range, shows note on hover over mark, pins it under line on click. Line numbers start at 1, same as `highlight`. Note with `to` before `from`, or lines past last line of `code`, dropped silently, no error. Count lines of `code` string after writing, blank lines included. Never put secret, credential, or personal data in note. Every reader of document sees it.

```json
{
  "type": "code",
  "language": "ts",
  "filename": "apps/api/src/features/session/index.ts",
  "highlight": [3],
  "code": "const { success } = await env.RATE_LIMITER.limit({ key: `create:${ip}` })\nif (!success) {\n  set.status = 429\n}",
  "notes": [
    { "from": 1, "text": "The key is the client IP, so one client cannot use up the limit of another." },
    { "from": 2, "to": 4, "text": "The request stops here with a 429 when the limit is reached." }
  ]
}
```
