# `table`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"table"` |
| `head` | yes | array of `label`, at least 1 |
| `rows` | yes | array of arrays of string, at least 1 row |
| `caption` | no | `label` |
| `align` | no | array of `left`, `center`, or `right`, at most 50; entry N aligns column N |
| `cells` | no | array of `{ row: position, col: position, tone: tone }`, at most 200 |

Cells are plain strings, never numbers. Write `"1200"`, not `1200`. Ragged rows are accepted by the schema but render badly; keep every row the same length as `head`.

Keep each cell to a phrase; the validator hints at a cell over 200 characters. Make the `caption` say what the table shows, not which file the numbers came from.

`align` lists one alignment per column, from the first column. A column with no entry is left aligned, so `["left", "right"]` right-aligns only the second column. Right-align columns of numbers.

`cells` colours single cells with a `tone`: `info`, `good`, `warn`, or `bad`. `row` and `col` count from 1, and `row` counts the body rows only: `row: 1` is the first array in `rows`, never the header. A position outside the table is ignored without an error. Colour the cells that carry the verdict, such as a failed check, not whole rows.

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
