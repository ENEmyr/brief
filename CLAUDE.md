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
