# `diff`

A change set, file by file. The semantic view lists each change with the agent's note, and the raw view prints the patch. Use it to review what a change did. For one snippet before and after use `ba`.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"diff"` |
| `files` | yes | array of 1 to 50 files |
| `files[].path` | yes | `label` |
| `files[].status` | yes | one of `added`, `modified`, `deleted`, `renamed` |
| `files[].from` | no | `label`, the old path of a renamed file |
| `files[].patch` | no | string of at most 50000 characters, unified diff text for the raw view |
| `files[].folded` | no | boolean; `true` starts the file folded, with an Unfold button |
| `files[].changes` | no | array of at most 30 changes |
| `changes[].symbol` | yes | `label`, the function, type, or key that changed |
| `changes[].change` | yes | one of `added`, `modified`, `removed`, `moved`, `config` |
| `changes[].summary` | yes | string of 1 to 280 characters, what the change does |
| `changes[].steps` | no | array of at most 8 `label`, the steps of an added function |
| `map` | no | object `{ nodes, edges }`, a change map above the file list |
| `map.nodes` | yes, when `map` is given | array of 1 to 40 `{ id: label, label: label, status? }` |
| `map.nodes[].status` | no | one of `added`, `modified`, `deleted` |
| `map.edges` | yes, when `map` is given | array of at most 80 `{ from: label, to: label }`, node `id` values |

A file's `status` takes `deleted`, while a change's `change` takes `removed`: the two vocabularies differ. A map node with a `status` is marked as changed, and a node that a changed node points to is drawn under it.

```json
{
  "type": "diff",
  "files": [
    {
      "path": "apps/api/src/features/session/index.ts",
      "status": "modified",
      "patch": "@@ -1,2 +1,4 @@\n export async function createSession(request) {\n+  if (await limited(request)) return tooMany()\n   return insert()\n }",
      "changes": [
        { "symbol": "createSession", "change": "modified", "summary": "Checks the rate limiter before it writes the session." }
      ]
    },
    {
      "path": "apps/api/wrangler.jsonc",
      "status": "modified",
      "folded": true,
      "changes": [{ "symbol": "RATE_LIMITER", "change": "config", "summary": "Adds the limiter binding at 10 calls per 60 seconds." }]
    }
  ]
}
```
