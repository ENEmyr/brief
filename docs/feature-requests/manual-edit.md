# Feature Request: Manual Edit

## Summary

Add an "Edit" button to the Brief reader UI that lets a human manually edit the payload content, then publish the edited version as a new Brief. This document records the technical constraints, recommended implementation approach, rejected alternatives, and open questions for future implementation.

**Status:** DEFERRED. This feature request captures the design work needed to implement this later without re-investigation.

## The Problem

Currently, a Brief payload is immutable once published. A human reader can annotate, highlight, and answer embedded questions, but cannot edit the content itself. The user requested an "Edit" button offering two capabilities:

1. Copy a prompt with all the human's "edit points" (e.g., highlights and notes) so an AI can generate an updated version. (This half is being built separately and is NOT the subject of this document.)
2. Manually edit the content in place and republish. (This is the deferred work documented here.)

The user explicitly requested a feature request with "all detail needed to implement it later on", including honest reasoning about rejected approaches, so that a future engineer or agent can pick it up cold and build it without redoing the investigation.

## Why Manual Edit Is Hard

### Constraint 1: The Payload Is Write-Once

Brief has no payload mutation API. Here is the complete API surface:

- `POST /api/session` (apps/api/src/features/session/index.ts) - creates one session, writes the payload once to D1, returns the session ID.
- `GET /api/session/:id` - fetches the session (returns the immutable payload plus metadata).
- `GET /api/session/:id/raw` - markdown export of the payload.
- `PUT /api/session/:id/save` (apps/api/src/features/save/index.ts) - does NOT mutate the payload. Instead, it manages encryption: `{mode:'plain'} | {mode:'encrypt', ciphertext, encParams}`. It switches between plaintext and password-protected encrypted storage of the SAME original payload.
- `PUT /api/session/:id/state` (apps/api/src/features/state/index.ts) - stores reader-session state (highlights, notes, which decision was answered) as an opaque string in KV. The server never validates or understands its inner shape. Reader state lives in an 800KB-capped, 90-day-TTL KV entry keyed `state:${id}`. The server returns 403 for encrypted sessions (bug-250 defense-in-depth).

There is no `PATCH /api/session/:id` or `PUT /api/session/:id/payload`. There is no "update the payload" operation anywhere. The payload is finalized at creation time.

### Constraint 2: Annotations Are Anchored By Position, Not By Stable ID

Highlights (the reader's selections) are stored in the opaque reader-state KV blob. Each highlight's anchor is defined in apps/web/src/features/reader/components/blockAnchor.ts as:

```typescript
{
  sid: number,     // index into payload.sections[]
  bid: number | null,  // index into sections[sid].blocks[], or null for section heading
  path: string,    // dotted path to the leaf string ('text' | 'title' | 'head.2' | 'rows.1.0' | 'items.3.label')
  start: number,   // character offset within that leaf string
  end: number,     // character offset within that leaf string
  text: string     // the quoted text, stored for visual verification
}
```

The critical problem: blocks have no `id` field. Position (sid, bid) is their only identity.

Sections DO have a `section.id` field (packages/schema/src/payload.ts). Decisions DO have a `decision.id` field. But blocks do not. A block IS identified by its place in its section's block array.

**Consequence:** If a human edits the payload and inserts, deletes, or reorders a block anywhere in the document, every highlight in that section silently re-points to the wrong block. The array indices shift. A highlight that was `bid:3` now points to the new block that landed at position 3, not the block the human originally highlighted.

There is a weak guard: the renderer (apps/web/src/features/reader/components/BlockRenderer.tsx) drops any highlight whose stored `text` no longer matches the text at its `(sid, bid, path, start, end)` coordinates. But this only hides broken anchors; it does not fix them. The human sees their highlights silently disappear, with no explanation.

## Recommended Approach: Fork, Not Mutate

**Design decision:** Manual edit should produce a FORK, not an in-place mutation. The human edits the payload, and publishing creates a NEW session at a NEW link. The original document and all its annotations stay untouched and valid.

**Advantages:**

- Dissolves the re-anchoring problem: there is nothing to re-anchor, because the old document still exists unchanged.
- Needs no ownership model or auth system (there is no model today; Brief operates on URLs-as-passwords, anyone with the link can read it).
- Needs no schema change (no stable block ids, no payload versioning in D1, no ownership fields).
- Needs no migration of existing highlights (they stay on the original session).
- Transparent to the highlight system: the old session's highlights continue to work, and the new session starts with zero highlights (or a copy thereof, if the human wants).

**V1 Scope:**

A minimal fork-based edit feature could be:

1. Add an "Edit" button in the Topbar (apps/web/src/features/reader/components/Topbar.tsx).
2. On click, show a modal with a JSON editor displaying `payload` (the Zod schema from packages/schema/src/payload.ts is already a workspace dependency in apps/web).
3. Validate the edited JSON client-side against `payloadSchema` (same Zod schema, already in apps/web's package.json).
4. If valid, offer a "Publish" button.
5. On "Publish", call `POST /api/session` with the edited payload JSON.
6. On success, navigate to the new session's link.

This is complete and functional. The editor UI would be a simple modal, not a rich WYSIWYG editor. The human is responsible for keeping the JSON valid and making sensible edits.

**Open Question (MUST RESOLVE BEFORE STARTING):** Can `POST /api/session` be called from the web origin (the reader UI's browser context), or is it gated to agent-only requests (e.g., via an `Authorization` header or IP allowlist)?

If `POST /api/session` is NOT callable from the web origin without a credential, the fallback is: offer a "Download payload JSON + instructions" button instead of in-app publish. The human downloads the file, has an agent re-run `POST /api/session` with the edited JSON (e.g., via the skill's "publish to Brief" flow), and manually navigates to the new link.

## Rejected Alternatives

### Alternative 1: True In-Place Mutation

Mutate the payload directly in D1, update the reader to re-anchor highlights to the mutated content.

**Why rejected:**

- **Stable block IDs required:** D1 would need to track which blocks are which across mutations. Blocks would need an `id` field added to every block type in packages/schema/src/payload.ts. This fires the entire 6-step schema update chain (per CLAUDE.md): regenerate skills/brief/payload.schema.json, update BLOCKS.md, update SKILL.md, update docs/skill.md, extend example.payload.json, run schema tests. Adding a field to 22 block types (p, note, warn, good, table, compare, stat, coverage, details, seq, state, layers, ba, bigo, code, mermaid, math, erd, heatmap, histogram, scatter, plot3d) is not a small change.
- **Ownership and auth required:** Who is allowed to edit a session? There is no ownership model today. You would need to add a creator-id field to sessions, check it on every edit, and handle "I forgot my session ID but still own it" UX (password? oauth?).
- **Payload versioning in D1:** The old payload must be preserved (for rollback, audit, or just "I want to see what I changed"). Add a `versions` table or a `payload_history` column, with migrations.
- **Highlight re-anchoring:** After a mutation, old highlights must be re-anchored to the new block positions. This is a non-trivial data migration. A highlight anchored to the old bid must be resolved through an id-based lookup and re-indexed to the new bid. This requires the id field above, a block-id-to-position map built from the new payload, and careful handling of blocks that were deleted (highlights pointing to deleted blocks must be cleared).
- **Editor UI for 22 block types:** A true WYSIWYG editor covering all 22 block types (with nested `details` blocks that contain other blocks) is a substantial UI project on its own. This is not a bullet-point task.
- **Realistic effort:** Multi-week project of its own. Not a feature; a product.

### Alternative 2: Local Overlay Diff

Store edits in the reader-state KV blob. Render them on top of the payload. Never mutate the payload in D1.

**Why rejected:**

- **Still needs editor UI:** All 22 block types, same as Alternative 1.
- **Highlights break under overlay:** A highlight anchored to the original payload text will have wrong offsets if the overlay has reordered, deleted, or reworded blocks. The highlight `(sid:0, bid:1, path:'text', start:10, end:20)` was pointing at "the 10th to 20th character of block 1's text field". If the overlay deletes block 1, or changes its text to something shorter, the offsets are garbage. The reader has to drop the highlight silently, just like in the mutation case.
- **Opaque validation:** The server stores the edit blob as an opaque string, never validates it, never knows if it's a valid delta. If the human's edits corrupt the structure, the reader UI either crashes trying to render the overlay, or silently renders wrong. No server-side safety net.
- **Worst of both worlds:** You need the editor complexity of Alternative 1, but you don't get the clarity and durability of a real mutated session. The edited content lives in an opaque KV string that only one reader can see, is not persistent across browsers, and can silently break on any schema change (if the edit blob contains a block type that was removed from the schema, what happens?).

The fork approach is cleaner: a new session is a real, visible, auditable, durable artifact.

## Open Questions

1. **Callable from the web origin?** Is `POST /api/session` reachable from the Brief reader UI's browser origin, or does it require an agent-only authorization? This determines whether the v1 edit flow can be in-app ("Publish" button) or out-of-app ("Download JSON, re-upload via agent").

2. **WYSIWYG vs JSON editor?** The user mentioned "edit the content" without specifying visual vs text editing. Is the v1 JSON-editor-in-modal enough, or does the user expect a visual editor for each block type? JSON editing is concrete and scope-bounded; WYSIWYG is much larger. Clarify with the user before starting.

3. **Copy edited payload, or publish directly?** If `POST /api/session` is not callable from the browser, should the fallback offer a "Copy to clipboard" button (human pastes into an agent chat), or "Download as JSON" (human uploads somewhere)? Clipboard copy is more frictionless.

4. **Preserve or clear highlights on fork?** When a new session is created, should it have zero highlights (clean slate), or should highlights from the original session be copied over to the new one (with re-anchoring risks if the edit changed block positions)? Recommend zero highlights for v1; let the human re-annotate if needed.

## Implementation Checklist (for Future Engineer/Agent)

When picking up this feature request:

1. **Resolve the API gate question first.** Call `POST /api/session` from a browser console against the live Brief API to confirm whether it's reachable from the reader's origin. If 403/Unauthorized, plan the download/re-upload fallback.

2. **Confirm WYSIWYG scope with the user.** JSON editor with client-side validation, or visual block-by-block editor? This decides whether v1 is one week or one month.

3. **Add "Edit" button to Topbar.tsx** and handle the click -> modal -> editor -> publish flow.

4. **Validate against payloadSchema.** Import `payloadSchema` from @brief/schema into apps/web/src/features/reader/components/ and call `.safeParse()` on the edited JSON. Display validation errors in the modal.

5. **Test the full round-trip:** Edit payload, publish, navigate to new session, verify the new session renders correctly. Verify the old session still has its original link and annotations unchanged.

6. **Consider UX details:**
   - Should the "Edit" button be visible only to readers with some kind of ownership (if ownership is ever added), or always?
   - Should there be a "Comparing" or "Based on" link back to the original session?
   - Should the new session have any metadata (edited_from_session_id, edited_at) logged for audit?

7. **Add e2e test** (e2e/tests/, using Playwright like export.spec.ts and save-unlock.spec.ts).

## Why In-Place Editing Was Not Chosen

If the user later insists on true in-place editing instead of forking:

- All six changes listed in Alternative 1 above become mandatory:
  1. Add stable id fields to all 22 block types in packages/schema/src/payload.ts.
  2. Execute the 6-step schema skill update chain (regenerate JSON schema, update docs, etc.).
  3. Add ownership model to sessions (creator_id, auth check, password reset).
  4. Add payload versioning table in D1.
  5. Implement highlight re-anchoring logic (id-based lookup, re-indexing).
  6. Build rich WYSIWYG editor for all 22 block types and recursive details nesting.

- This is not a PR; this is a separate product phase. The fork approach solves the immediate user problem (manual edit) with zero schema changes and zero ownership complexity.

## References

- Payload schema: packages/schema/src/payload.ts (definition of all 22 block types)
- Session API: apps/api/src/features/session/index.ts (POST /api/session, GET /api/session/:id)
- Save/encryption API: apps/api/src/features/save/index.ts (PUT /api/session/:id/save)
- Reader state API: apps/api/src/features/state/index.ts (PUT /api/session/:id/state)
- Highlight anchoring: apps/web/src/features/reader/components/blockAnchor.ts
- Reader UI top-level: apps/web/src/features/reader/components/SessionView.tsx, Topbar.tsx
- Block rendering: apps/web/src/features/reader/components/BlockRenderer.tsx
- Project constraints: CLAUDE.md (schema changes require 6-step skill update chain)
