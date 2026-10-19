# `stat`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"stat"` |
| `items` | yes | array of stat items, min 1 |
| `caption` | no | `label`, one line about whole tile row |

Stat item:

| Field | Required | Type |
| --- | --- | --- |
| `label` | yes | `label` |
| `value` | yes | string (any string, incl `""`) |
| `hint` | no | string |
| `tone` | no | stat tone: one of `mauve`, `blue`, `green`, `red`, `peach`, `teal`, `yellow` |
| `hintTone` | no | stat tone, colour of `hint` text |
| `spark` | no | array of 2-32 numbers, each >=0 |

`tone` and `hintTone` take stat palette only. `info`, `good`, `warn`, `bad` fail here, same any other colour name. Values are strings: `"82 ms"`, `"48,120"`, `"3.2x"`.

`spark` draws values as small bars in tile, left to right, marks highest bar. Oldest value first. Give real series behind `value`, e.g. last seven daily counts; tile with no history has no `spark`. Negative numbers fail validation. Use `hintTone` when hint is verdict, e.g. `"+12% since last week"` in `red`.

Tile holds number + few words. Keep `label` and `hint` short; validator hints at either over 50 chars. Qualifiers like how number measured go in paragraph beside tile.

```json
{
  "type": "stat",
  "caption": "Session endpoint, last 7 days",
  "items": [
    { "label": "Requests per minute", "value": "10", "hint": "Per IP, current limit", "tone": "blue" },
    { "label": "P95 latency", "value": "82 ms", "tone": "green", "spark": [96, 91, 88, 85, 84, 82, 82] },
    { "label": "Unbounded endpoints", "value": "3", "tone": "red", "hint": "Up from 1", "hintTone": "red" }
  ]
}
```
