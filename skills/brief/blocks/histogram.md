# `histogram`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"histogram"` |
| `bins` | yes | array of `{ label: label, count: number }`, at least 1 |
| `title` | no | `label` |
| `threshold` | no | `{ bin: position, label: short, value?: short }` |

`threshold` marks a limit on the chart, such as a timeout or a target. `bin` counts the bins from 1, and the line sits on the left edge of that bin. The reader colours that bin and every bin after it as past the limit. The line shows `label`, followed by `value` when you give one, and each is 1 to 40 characters. A `bin` past the last bin draws no threshold and gives no error. A histogram has one threshold and no separate percentile field. To mark a percentile such as p95, use `threshold` with `"label": "p95"` and the measured value in `value`.

```json
{
  "type": "histogram",
  "title": "Session duration",
  "bins": [
    { "label": "0-5 min", "count": 42 },
    { "label": "5-15 min", "count": 88 },
    { "label": "15+ min", "count": 17 }
  ],
  "threshold": { "bin": 3, "label": "Idle timeout", "value": "15 min" }
}
```
