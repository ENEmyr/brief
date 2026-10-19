# `list`

A bulleted or numbered list of short items. Use it when each item is one phrase or one step with nothing else to compare. When the items carry two or more attributes, such as a severity and an owner, use a `table` with one row per item.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"list"` |
| `items` | yes | array of strings of 1 to 500 characters, 1 to 100 items |
| `ordered` | no | boolean; `true` numbers the items, `false` or absent draws bullets |
| `caption` | no | `label` |

Set `ordered` to `true` only when the order matters, such as steps to follow. Items cannot nest.

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
