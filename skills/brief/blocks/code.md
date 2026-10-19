# `code`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"code"` |
| `language` | yes | `label` |
| `code` | yes | string (may be `""`) |
| `filename` | no | `label` |
| `highlight` | no | array of integers of 1 or more, 1-indexed line numbers |
| `notes` | no | array of code note objects, at most 30 |

Code note object:

| Field | Required | Type |
| --- | --- | --- |
| `from` | yes | `position`, the first noted line |
| `to` | no | `position`, the last noted line; absent means the note covers `from` only |
| `text` | yes | string of 1 to 280 characters |

A note is your comment on a line or a range of lines. The reader marks the last line of the range, shows the note when the reader points at the mark, and pins it under the line on a click. Line numbers count from 1, the same as `highlight`. A note whose `to` is before its `from`, or whose lines run past the last line of `code`, is dropped without an error. Count the lines of the `code` string after you write it, including blank lines. Never put a secret, a credential, or personal data in a note. Every reader of the document sees it.

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
