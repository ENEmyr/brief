# `note`, `warn`, `good`

Same three fields for all three types. `note` is informational, `warn` signals risk, `good` signals a positive result.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"note"`, `"warn"`, or `"good"` |
| `text` | yes | `text` |
| `title` | no | `label` |

```json
{ "type": "warn", "title": "Quota risk", "text": "At 200 requests per second the free D1 tier throttles within four minutes." }
```
