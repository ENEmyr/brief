# What comes back

The reader replies by pasting a generated prompt into this conversation. There are two shapes, both plain text. Recognise them and act; do not ask the human to restate them.

**Decision answers**, generated from the decision dock, one block per decision:

```text
Reply to the "Rate limiting for /api/session" doc (session aB3xYz01qWe9rT) - my decisions:

[limiter-choice] Which rate limiter should we put in front of POST /api/session?
  - Choice: Cloudflare Rate Limiting binding
  - Note: Ship it behind a flag.

[rollout] How should the limit reach production?
  - Choice: Shadow mode for one week; Alert on sustained 429s

Please act on the answers above; consider the extra context for any item that has a note
```

The bracketed name is the decision `id` you set. `Choice` holds option **labels**, semicolon-separated when `multi` is true, or `(not answered)`. A `Note` is free text the reader added, and it usually carries a constraint that changes the work; treat it as part of the answer, not as decoration.

**A question about a passage**, generated when the reader highlights text and asks about it:

```text
Question about a specific part of the "Rate limiting for /api/session" doc (session aB3xYz01qWe9rT).

Reference:
- URL: https://brief.algoryth.me/s/aB3xYz01qWe9rT#evidence
- Location: section 02 "What the traffic shows" - paragraph 3 - chars 41-118
- Quoted text: "the free D1 tier throttles within four minutes"

Question:
Where does the four minute figure come from?

Please answer specifically about the quoted part above, using the reference to locate it.
```

Answer the quoted passage specifically. If the answer changes a claim in the document, say so plainly: a published document is immutable, so a correction lives in the conversation or in a new document.

When the document has decisions, design them so this loop closes in one pass. A question the human cannot settle from the document alone is a question that comes back as another round trip.
