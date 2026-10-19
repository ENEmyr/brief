# `list`

Bulleted or numbered list of short items. Use when each item is one phrase or one step, nothing else to compare. Items carry two+ attributes (e.g. severity and owner) -> use `table`, one row per item.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"list"` |
| `items` | yes | array of strings, 1-500 chars, 1-100 items |
| `ordered` | no | boolean; `true` numbers items, `false` or absent draws bullets |
| `caption` | no | `label` |

Set `ordered` to `true` only when order matters, e.g. steps to follow. Items cannot nest.

```json
{
  "type": "list",
  "ordered": true,
  "caption": "Steps to turn the limit on",
  "items": [
    "Add the rate limiter binding to the API configuration.",
    "Deploy the API.",
    "Send eleven requests in one minute and check that the last one gets a 429."
  ]
}
```
