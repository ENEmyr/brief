# `bigo`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"bigo"` |
| `series` | yes | array of `{ label: label, curve: curve }`, at least 1 |
| `title` | no | `label` |
| `maxN` | no | integer from 10 to 1,000,000 |

`curve` is one of exactly: `1`, `logn`, `sqrt`, `n`, `nlogn`, `n2`, `n3`, `2n`. They are strings, not numbers: `"curve": "n2"`, never `"curve": "O(n^2)"`.

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
