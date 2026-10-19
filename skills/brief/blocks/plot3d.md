# `plot3d`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"plot3d"` |
| `kind` | yes | `"scatter3d"` or `"surface"` |
| `points` | no | array of `[number, number, number]` tuples |
| `grid` | no | array of arrays of number |
| `title` | no | `label` |
| `xLabel`, `yLabel`, `zLabel` | no | `label` |

Schema marks `points` and `grid` both optional, so `plot3d` with neither passes validation, renders empty. Give `points` for `scatter3d`, `grid` for `surface`.

```json
{
  "type": "plot3d",
  "kind": "scatter3d",
  "title": "Cost against concurrency and payload size",
  "xLabel": "Concurrency",
  "yLabel": "Payload KB",
  "zLabel": "USD per 1k",
  "points": [[1, 12, 0.4], [8, 48, 1.1], [32, 120, 3.7]]
}
```
