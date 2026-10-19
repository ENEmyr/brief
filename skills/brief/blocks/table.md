# `table`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"table"` |
| `head` | yes | array of `label`, at least 1 |
| `rows` | yes | array of arrays of string, at least 1 row |
| `caption` | no | `label` |
| `align` | no | array of `left`, `center`, or `right`, at most 50; entry N aligns column N |
| `cells` | no | array of `{ row: position, col: position, tone: tone }`, at most 200 |

Cells plain strings, never numbers. Write `"1200"`, not `1200`. Schema accepts ragged rows but they render badly; keep every row same length as `head`.

Keep each cell to phrase; validator hints at cell over 200 characters. `caption` say what table shows, not which file numbers came from.

`align` lists one alignment per column, from first column. Column with no entry left aligned, so `["left", "right"]` right-aligns only second column. Right-align number columns.

`cells` colours single cells with `tone`: `info`, `good`, `warn`, or `bad`. `row` and `col` count from 1, and `row` counts body rows only: `row: 1` is first array in `rows`, never header. Position outside table ignored, no error. Colour cells carrying verdict, such as failed check, not whole rows.

```json
{
  "type": "table",
  "caption": "Write volume by endpoint, last 7 days",
  "head": ["Endpoint", "Writes", "P95 latency"],
  "align": ["left", "right", "right"],
  "rows": [
    ["/api/session", "48,120", "82 ms"],
    ["/api/session/:id/state", "9,004", "31 ms"]
  ],
  "cells": [{ "row": 1, "col": 3, "tone": "warn" }]
}
```
