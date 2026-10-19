# `details`

Collapsible disclosure. `blocks` array holds any block type except another `details`; `details` nested in `details` fails validation.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"details"` |
| `summary` | yes | `label` |
| `blocks` | yes | array of non-`details` blocks, at least 1 |

```json
{
  "type": "details",
  "summary": "Raw wrangler tail output (12 lines)",
  "blocks": [
    { "type": "code", "language": "text", "code": "POST /api/session 201 82ms\nPOST /api/session 429 4ms" }
  ]
}
```
