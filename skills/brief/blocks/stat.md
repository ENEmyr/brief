# `stat`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"stat"` |
| `items` | yes | array of stat items, at least 1 |
| `caption` | no | `label`, one line about the whole row of tiles |

Stat item:

| Field | Required | Type |
| --- | --- | --- |
| `label` | yes | `label` |
| `value` | yes | string (any string, including `""`) |
| `hint` | no | string |
| `tone` | no | stat tone: one of `mauve`, `blue`, `green`, `red`, `peach`, `teal`, `yellow` |
| `hintTone` | no | stat tone, the colour of the `hint` text |
| `spark` | no | array of 2 to 32 numbers, each 0 or more |

`tone` and `hintTone` take the stat palette only. `info`, `good`, `warn`, and `bad` fail here, as does any other colour name. Values are strings: `"82 ms"`, `"48,120"`, `"3.2x"`.

`spark` draws the values as small bars in the tile, from left to right, and marks the highest bar. List the oldest value first. Give it the real series behind `value`, such as the last seven daily counts; a tile with no history has no `spark`. Negative numbers fail validation. Use `hintTone` when the hint is the verdict, such as `"+12% since last week"` in `red`.

A tile holds a number and a few words. Keep `label` and `hint` short; the validator hints at either one over 50 characters. Qualifiers such as how the number was measured go in the paragraph beside the tile.

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
