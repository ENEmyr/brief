# `mermaid`

Rendered client side, so invalid Mermaid body passes API, fails in reader's browser. Use named block instead where one exists. Before POST, parse every mermaid block: the Mermaid Chart MCP validate tool, or `mermaid.parse(code)` in a headless browser with mermaid loaded.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"mermaid"` |
| `code` | yes | string, at least 1 character |
| `title` | no | `label` |

```json
{ "type": "mermaid", "title": "Rollout", "code": "gantt\n  title Rollout\n  section Phase 1\n  Shadow mode :a1, 2026-07-14, 5d" }
```
