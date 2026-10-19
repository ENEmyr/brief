# `note`, `warn`, `good`

All three types share same three fields. `note` = info, `warn` = risk, `good` = positive result.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"note"`, `"warn"`, or `"good"` |
| `text` | yes | `text` |
| `title` | no | `label` |

```json
{ "type": "warn", "title": "Quota risk", "text": "At 200 requests per second the free D1 tier throttles within four minutes." }
```
