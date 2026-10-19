# `seq`

An interactive sequence diagram. Every `from` and `to` must be a string that appears in `actors`, or the step renders against nothing.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"seq"` |
| `actors` | yes | array of `label`, at least 2 |
| `steps` | yes | array of step objects, at least 1 |
| `title` | no | `label` |

Step object:

| Field | Required | Type |
| --- | --- | --- |
| `from` | yes | `label`, must match an actor |
| `to` | yes | `label`, must match an actor |
| `label` | yes | string (may be `""`), drawn on the arrow |
| `note` | no | string |
| `text` | no | `label`, the step as a sentence in the step list |

The reader also shows the steps as a list of sentences. Without `text`, that list shows the step as its `from`, an arrow, its `to`, and its `label`. Set `text` to say what the step does in plain words, such as "The API stores the document". Keep `label` short, because it sits on the arrow.

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
