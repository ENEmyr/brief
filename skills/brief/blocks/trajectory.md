# `trajectory`

Agent run as log: what asked, what read and ran, what changed, decided, assumed. Reader shows each step as time since first step, filters by kind, lets reader mark flagged steps; marks return in reply as a `Flags` list (see `reference/replies.md` in the skill folder). Use when how agent reached result changes how far to trust it. Not dump of every command.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"trajectory"` |
| `steps` | yes | array of 1 to 200 steps |
| `steps[].at` | yes | ISO 8601 UTC date+time, ending `Z`, e.g. `"2026-07-12T09:05:40Z"`. Fractional seconds allowed. Offset like `+07:00` fails validation. |
| `steps[].kind` | yes | one of `request`, `read`, `run`, `edit`, `decision`, `assumption`, `note` |
| `steps[].title` | yes | `label` |
| `steps[].detail` | no | string, 1 to 400 chars |
| `steps[].flag` | no | boolean; `true` highlights step, lets reader mark it |
| `stats` | no | object `{ seconds?, tokens? }`, each integer >= 0: run length and tokens used. No `seconds` -> reader shows time first step to last. |

Flag steps reader should check, e.g. assumption result rests on. Filters: all, decided (`decision`), assumed (`assumption`), edits (`edit`), reads plus bash (`read` and `run`). Reader hides filter chip when no step matches kind, so run with no `edit` step shows no edits chip. All chip always shows.

```json
{
  "type": "trajectory",
  "steps": [
    { "at": "2026-07-12T09:00:00Z", "kind": "request", "title": "Check whether one client can flood session creation" },
    { "at": "2026-07-12T09:05:40Z", "kind": "run", "title": "Sent 500 create requests from one address", "detail": "All 500 returned 201." },
    { "at": "2026-07-12T09:08:00Z", "kind": "assumption", "title": "Production traffic comes from many addresses", "flag": true }
  ],
  "stats": { "seconds": 480, "tokens": 38200 }
}
```
