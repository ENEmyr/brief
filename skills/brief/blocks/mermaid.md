# `mermaid`

Rendered client side, so an invalid Mermaid body passes the API and fails in the reader's browser. Use a named block instead where one exists.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"mermaid"` |
| `code` | yes | string, at least 1 character |
| `title` | no | `label` |

```json
{ "type": "mermaid", "title": "Rollout", "code": "gantt\n  title Rollout\n  section Phase 1\n  Shadow mode :a1, 2026-07-14, 5d" }
```
