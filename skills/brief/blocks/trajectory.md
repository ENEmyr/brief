# `trajectory`

The agent's run as a log: what it was asked, what it read and ran, what it changed, decided, and assumed. The reader shows each step as time since the first step, filters by kind, and lets the reader mark flagged steps; the marks come back in the reply. Use it when how the agent reached the result changes how far to trust it. Do not use it as a dump of every command.

| Field | Required | Type |
| --- | --- | --- |
| `type` | yes | `"trajectory"` |
| `steps` | yes | array of 1 to 200 steps |
| `steps[].at` | yes | ISO 8601 date and time in UTC, ending in `Z`, such as `"2026-07-12T09:05:40Z"`. Fractions of a second are allowed. An offset such as `+07:00` fails validation. |
| `steps[].kind` | yes | one of `request`, `read`, `run`, `edit`, `decision`, `assumption`, `note` |
| `steps[].title` | yes | `label` |
| `steps[].detail` | no | string of 1 to 400 characters |
| `steps[].flag` | no | boolean; `true` highlights the step and lets the reader mark it |
| `stats` | no | object `{ seconds?, tokens? }`, each an integer of 0 or more: the run's length and the tokens it used. Without `seconds`, the reader shows the time from the first step to the last. |

Flag the steps the reader should check, such as an assumption the result rests on. The filters are all, decided (`decision`), assumed (`assumption`), edits (`edit`), and reads plus bash (`read` and `run`). The reader hides a filter chip when no step has a matching kind, so a run with no `edit` step shows no edits chip. The all chip always shows.

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
