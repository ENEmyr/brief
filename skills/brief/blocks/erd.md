# `erd`

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"erd"` |
| `tables` | yes | table object array, min 1 |
| `title` | no | `label` |

Table object:

| Field | Required | Type |
| --- | --- | --- |
| `name` | yes | `label` |
| `columns` | yes | column object array, min 1 |

Column object:

| Field | Required | Type |
| --- | --- | --- |
| `name` | yes | `label` |
| `type` | yes | `label`, free text e.g. `"text"` or `"integer"` |
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
