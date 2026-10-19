# `diff`

Change set, per file. Semantic view lists each change with agent note; raw view prints patch. Use to review what change did. One snippet before/after -> use `ba`.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"diff"` |
| `files` | yes | array, 1-50 files |
| `files[].path` | yes | `label` |
| `files[].status` | yes | one of `added`, `modified`, `deleted`, `renamed` |
| `files[].from` | no | `label`, old path of renamed file |
| `files[].patch` | no | string <=50000 chars, unified diff text for raw view |
| `files[].folded` | no | boolean; `true` starts file folded, with Unfold button |
| `files[].changes` | no | array <=30 changes |
| `changes[].symbol` | yes | `label`, changed function, type, or key |
| `changes[].change` | yes | one of `added`, `modified`, `removed`, `moved`, `config` |
| `changes[].summary` | yes | string 1-280 chars, what change does |
| `changes[].steps` | no | array <=8 `label`, steps of added function |
| `map` | no | object `{ nodes, edges }`, change map above file list |
| `map.nodes` | yes, when `map` given | array 1-40 `{ id: label, label: label, status? }` |
| `map.nodes[].status` | no | one of `added`, `modified`, `deleted` |
| `map.edges` | yes, when `map` given | array <=80 `{ from: label, to: label }`, node `id` values |

File `status` takes `deleted`; change `change` takes `removed`. Vocabularies differ. Map node with `status` marked changed. Node pointed to by changed node drawn under it.

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
