# `math`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"math"` |
| `latex` | yes | string, at least 1 character |
| `title` | no | `label` |

Rendered with KaTeX. Backslashes must be escaped in JSON: `\\frac`, not `\frac`.

```json
{ "type": "math", "title": "Token bucket refill", "latex": "t_{\\text{wait}} = \\frac{n - b}{r}" }
```
