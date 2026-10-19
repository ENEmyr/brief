# What comes back

Reader replies by pasting generated prompt into this conversation. Three shapes, all plain text. Recognise them and act; don't ask human to restate.

**Decision answers**, generated from decision dock, one block per decision:

```text
Reply to the "Rate limiting for /api/session" doc (session aB3xYz01qWe9rT) - my decisions:

[limiter-choice] Which rate limiter should we put in front of POST /api/session?
  - Choice: Cloudflare Rate Limiting binding
  - Note: Ship it behind a flag.

[rollout] How should the limit reach production?
  - Choice: Shadow mode for one week; Alert on sustained 429s

Please act on the answers above; consider the extra context for any item that has a note
```

Bracketed name = decision `id` you set. `Choice` holds option **labels**, semicolon-separated when `multi` true, `Other: <text>` when reader typed own answer instead of picking an option, or `(not answered)`. `Note` = free text reader added; usually carries constraint that changes work. Treat as part of answer, not decoration.

When reader marked flagged steps of a `trajectory` block, a `Flags (steps the agent decided alone or assumed):` list follows. Each line gives reader's mark (`Ask me` or `OK`), time since first step, step kind, and step title.

**A question about a passage**, generated when reader highlights text and asks about it:

```text
Question about a specific part of the "Rate limiting for /api/session" doc (session aB3xYz01qWe9rT).

Reference:
- URL: https://brief.algoryth.me/s/aB3xYz01qWe9rT#evidence
- Location: section 02 "What the traffic shows" - block 3 - chars 41-118
- Quoted text: "the free D1 tier throttles within four minutes"

Question:
Where does the four minute figure come from?

Please answer specifically about the quoted part above, using the reference to locate it.
```

`block 3` = third block of that section, counted from 1. A highlight inside a table or list adds the string path, e.g. `block 2 (rows.3.1)`; a highlight on the section title reads `heading`. The reader separates the parts with a middle dot and writes the range with an en dash.

Answer quoted passage specifically. If answer changes claim in document, say plainly: published document immutable, so correction lives in conversation or new document.

**A request to update the document**, generated when reader asks for edits after highlighting, answering decisions, or marking flagged steps:

```text
Update the "Rate limiting for /api/session" doc (session aB3xYz01qWe9rT) using my edit points below.
Reference: https://brief.algoryth.me/s/aB3xYz01qWe9rT

Source: https://brief-api.algoryth.me/api/session/aB3xYz01qWe9rT/raw (the current document as markdown)

Edit points:

1. section 02 "What the traffic shows" - block 3 - chars 41-118
   Quoted: "the free D1 tier throttles within four minutes"
   Edit request: Name the day this was measured.

Produce an updated payload that reflects the edit points and decisions above, and publish
it as a new Brief. Do not try to modify this session in place; the original link stays valid.
```

An edit point may carry `Reader question:` instead of, or beside, `Edit request:`. `Decisions:` and `Flags` lists follow when reader gave them. For an encrypted document, Source line asks human to paste content, because `/raw` returns 403. Read Source, apply every edit point, publish result as a new document, give human the new link.

When document has decisions, design them so loop closes in one pass. Question human can't settle from document alone = another round trip.
