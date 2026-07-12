# Brief

Brief turns an agent's work into an interactive decision document: sections, diagrams, charts, code, math, and inline yes/no or multiple-choice questions the human answers in place. The agent sends one JSON payload and gets back one link. The reader UI is live at https://brief.algoryth.me and the API at https://brief-api.algoryth.me.

## Project map

- `apps/web`: Next.js static export reader UI, served from Cloudflare Pages.
- `apps/api`: Cloudflare Worker API built with Elysia, backed by D1 and KV.
- `packages/schema`: shared Zod payload schema plus the markdown export used by `/raw`.
- `packages/config`: shared tooling config (eslint, tsconfig).
- `e2e`: Playwright end-to-end journeys against local builds of both apps.
- `docs/`: public documentation. Decisions live in `docs/adr/`. `CONTEXT.md` at the repo root is the domain glossary.

## Commands

Run everything from the repo root with bun. The quality gate chain is:

```bash
bun run lint && bun run typecheck && bun run test && bun run build
```

Each script fans out through Turborepo, so a single workspace can be targeted with a filter, for example `bun run test --filter=@brief/web` or `bun run test --filter=@brief/api`. Workspace names are `@brief/web`, `@brief/api`, `@brief/schema`, `@brief/config`, and `@brief/e2e`.

End-to-end tests run with `bun run e2e`, which executes `e2e/run.sh`: it builds `apps/web` with the API URL baked in, applies local D1 migrations, then runs Playwright with both local servers managed by the Playwright config.

## Changing the payload schema

`packages/schema/src/payload.ts` is the source of truth for the payload, and `skills/brief/` is how agents learn to write one. An agent cannot read the Zod file: it is not on the machine the agent runs on. So a schema change that the skill does not describe is a schema change agents will get wrong, and they will get it wrong silently, by guessing field names.

Any change to `payloadSchema` (a new block type, a new field, a new enum value, a tighter constraint) is not finished until the skill has caught up:

1. Regenerate the skill's copy of the rules: `cd packages/schema && bun run gen:skill-schema`. This rewrites `skills/brief/payload.schema.json`, which is what the skill's offline validator reads. Never hand-edit that file.
2. Document it in `skills/brief/BLOCKS.md`: a heading for the block with a field table (required, optional, exact type, exact enum values) and a valid JSON example, plus a row in the "Choosing a block" table saying when to reach for it and what to use instead.
3. Update the block count and, where a new field invites a specific mistake, the "Common mistakes" table in `skills/brief/SKILL.md`.
4. Update the block table in `docs/skill.md`, which is the human-facing companion.
5. Extend `skills/brief/example.payload.json` if the change belongs in a worked example.
6. Run `bun run test --filter=@brief/schema`.

Most of that list is enforced. `packages/schema/test/skill-docs.test.ts` fails when a block type or an accepted enum value is missing from the skill's documentation, and `skill-validator.test.ts` fails when the committed `payload.schema.json` drifts from what the Zod schema generates, or when the skill's validator and `payloadSchema` disagree on whether a payload is valid. Read the failure message; it names the file to fix.

`skills/brief/validate.mjs` interprets the generated JSON Schema, so it needs no change for a new block or field. It needs one only if the schema starts emitting a JSON Schema construct the engine does not implement, and the parity test in `skill-validator.test.ts` is what tells you that happened.

The skill ships from this repository: `npx skills add ENEmyr/brief` copies the whole `skills/brief/` folder from the default branch, so a skill change reaches users when it merges to `main`. There is nothing to publish separately. Existing users pull it with `npx skills update brief`.

## Working rules

- Vertical slice architecture. Code lives in feature folders under `src/features/`. Do not create horizontal top-level layers such as `components/` or `utils/`. Cross-feature imports go through each feature's `index.ts` public API.
- Trunk-based development. Work on task branches, open PRs, squash-merge. Commits follow conventional commit format with a subject of 72 characters or fewer, and no AI attribution lines.
- Run the full gate chain above before every commit.
- When a code simplification pass is available (for example a `/simplify` command or the code-simplifier agent), run it on your changes before committing.
- When SonarQube tooling is available (the sonar MCP server or CLI), analyze changed files and fix the findings before finishing. Sonar is intentionally not part of CI.
- Written deliverables (docs, PR descriptions, commit bodies) use plain ASCII punctuation: no emoji, no em or en dashes, no decorative symbols.

## Optional safety hook

Teams that want a hard stop on force-pushing to main can add a PreToolUse hook to `.claude/settings.json` and adapt the pattern to their own workflow:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -e '.tool_input.command | test(\"git push.*(--force|-f).*main\")' >/dev/null && exit 2 || exit 0"
          }
        ]
      }
    ]
  }
}
```
