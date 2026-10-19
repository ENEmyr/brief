# `scatter`

Each point = two-number tuple `[x, y]`, not object. `{ "x": 1, "y": 2 }` fails validation.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"scatter"` |
| `series` | yes | array of `{ label: label, points: [number, number][] }`, >=1 series, >=1 point each |
| `title` | no | `label` |
| `xLabel` | no | `label` |
| `yLabel` | no | `label` |

```json
{
  "type": "scatter",
  "title": "Latency against payload size",
  "xLabel": "Payload KB",
  "yLabel": "P95 ms",
  "series": [
    { "label": "Today", "points": [[12, 80], [48, 96], [120, 143]] },
    { "label": "With compression", "points": [[12, 78], [48, 84], [120, 101]] }
  ]
}
```
