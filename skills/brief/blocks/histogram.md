# `histogram`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"histogram"` |
| `bins` | yes | array of `{ label: label, count: number }`, at least 1 |
| `title` | no | `label` |
| `threshold` | no | `{ bin: position, label: short, value?: short }` |

`threshold` marks chart limit (e.g. timeout, target). `bin` counts bins from 1; line sits on left edge of that bin. Reader colours that bin + every later bin as past limit. Line shows `label`, then `value` if given; each 1-40 chars. `bin` past last bin -> no threshold drawn, no error. Histogram has one threshold, no separate percentile field. To mark percentile like p95: use `threshold` with `"label": "p95"`, measured value in `value`.

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
