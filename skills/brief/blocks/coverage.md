# `coverage`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"coverage"` |
| `items` | yes | array of coverage items, at least 1 |
| `caption` | no | `label` |

Coverage item:

| Field | Required | Type |
| --- | --- | --- |
| `label` | yes | `label` |
| `status` | yes | one of `full`, `partial`, `missing` |
| `note` | no | string |

```json
{
  "type": "coverage",
  "caption": "Test coverage of the flush path",
  "items": [
    { "label": "Buffer write", "status": "full" },
    { "label": "Two-phase flush", "status": "partial", "note": "Only the normal case is tested. No test covers a crash between phases." },
    { "label": "Token revocation", "status": "missing" }
  ]
}
```
