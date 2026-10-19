# `seq`

Interactive sequence diagram. Every `from` and `to` must be string in `actors`, else reader drops that step, no error.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"seq"` |
| `actors` | yes | array of `label`, min 2 |
| `steps` | yes | array of step objects, min 1 |
| `title` | no | `label` |

Step object:

| Field | Required | Type |
| --- | --- | --- |
| `from` | yes | `label`, must match actor |
| `to` | yes | `label`, must match actor |
| `label` | yes | string (may be `""`), drawn on arrow |
| `note` | no | string |
| `text` | no | `label`, step as sentence in step list |

Reader also shows steps as sentence list. Without `text`, list shows step as `from`, arrow, `to`, `label`. Set `text` to say what step does in plain words, e.g. "The API stores the document". Keep `label` short - sits on arrow.

```json
{
  "type": "seq",
  "title": "Session publish",
  "actors": ["Agent", "Ingest API", "D1"],
  "steps": [
    { "from": "Agent", "to": "Ingest API", "label": "POST /api/session", "text": "The agent sends the document." },
    { "from": "Ingest API", "to": "D1", "label": "INSERT session", "note": "Payload stored as a JSON string.", "text": "The API stores it." },
    { "from": "Ingest API", "to": "Agent", "label": "201 { id, url }", "text": "The API returns the link." }
  ]
}
```
