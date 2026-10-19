# `math`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"math"` |
| `latex` | yes | string, min 1 char |
| `title` | no | `label` |

KaTeX render. Escape backslashes in JSON: `\\frac`, not `\frac`.

```json
{ "type": "math", "title": "Token bucket refill", "latex": "t_{\\text{wait}} = \\frac{n - b}{r}" }
```
