# `erd`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"erd"` |
| `tables` | yes | array of table objects, at least 1 |
| `title` | no | `label` |

Table object:

| Field | Required | Type |
| --- | --- | --- |
| `name` | yes | `label` |
| `columns` | yes | array of column objects, at least 1 |

Column object:

| Field | Required | Type |
| --- | --- | --- |
| `name` | yes | `label` |
| `type` | yes | `label`, free text such as `"text"` or `"integer"` |
| `pk` | no | boolean |
| `fk` | no | `{ table: label, column: label }` |

```json
{
  "type": "erd",
  "tables": [
    {
      "name": "sessions",
      "columns": [
        { "name": "id", "type": "text", "pk": true },
        { "name": "payload", "type": "text" }
      ]
    },
    {
      "name": "annotations",
      "columns": [
        { "name": "id", "type": "text", "pk": true },
        { "name": "session_id", "type": "text", "fk": { "table": "sessions", "column": "id" } }
      ]
    }
  ]
}
```
