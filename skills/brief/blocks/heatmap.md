# `heatmap`

`values` is row-major: `values[y][x]`. Give it `yLabels.length` rows, each of `xLabels.length` numbers.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"heatmap"` |
| `xLabels` | yes | array of `label`, at least 1 |
| `yLabels` | yes | array of `label`, at least 1 |
| `values` | yes | array of arrays of number, at least 1 row |
| `title` | no | `label` |

```json
{
  "type": "heatmap",
  "title": "Errors by hour and day",
  "xLabels": ["00", "06", "12", "18"],
  "yLabels": ["Mon", "Tue"],
  "values": [
    [0, 2, 11, 4],
    [1, 0, 9, 3]
  ]
}
```
