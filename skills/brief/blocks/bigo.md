# `bigo`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"bigo"` |
| `series` | yes | array of `{ label: label, curve: curve }`, min 1 |
| `title` | no | `label` |
| `maxN` | no | integer 10-1,000,000 |

`curve` exactly one of: `1`, `logn`, `sqrt`, `n`, `nlogn`, `n2`, `n3`, `2n`. Strings, not numbers: `"curve": "n2"`, never `"curve": "O(n^2)"`.

```json
{
  "type": "bigo",
  "title": "Lookup cost as the buffer grows",
  "maxN": 1000,
  "series": [
    { "label": "Current linear scan", "curve": "n" },
    { "label": "Proposed index", "curve": "logn" }
  ]
}
```
