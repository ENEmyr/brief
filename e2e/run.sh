#!/usr/bin/env bash
# Orchestrates the Playwright e2e suite: builds apps/web with the API base
# URL baked in (Next static export reads NEXT_PUBLIC_API_URL at build time,
# not at runtime), applies local D1 migrations from apps/api's own cwd (the
# same cwd playwright.config.ts's `wrangler dev` webServer entry uses --
# wrangler's local D1/KV state lives under <cwd>/.wrangler/state, so a
# mismatched cwd here would migrate a database `wrangler dev` never sees),
# then runs `playwright test`, which starts/waits-for/tears down both local
# servers itself via its two webServer entries.
set -euo pipefail

# A CDPATH inherited from the caller's interactive shell makes bash's `cd`
# builtin auto-print the resolved directory to stdout on top of whatever the
# script does explicitly, corrupting every `$(cd ... && pwd)` capture below.
# Unset it unconditionally rather than assuming a clean environment.
unset CDPATH

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

API_URL="${API_URL:-http://localhost:8787}"
WEB_URL="${WEB_URL:-http://localhost:8788}"
export API_URL WEB_URL

echo "==> Building apps/web (NEXT_PUBLIC_API_URL=${API_URL})"
(cd "${ROOT_DIR}/apps/web" && NEXT_PUBLIC_API_URL="${API_URL}" bun run build)

echo "==> Applying local D1 migrations (brief-local)"
(cd "${ROOT_DIR}/apps/api" && bunx wrangler d1 migrations apply brief-local --local)

echo "==> Running Playwright e2e suite"
(cd "${SCRIPT_DIR}" && bunx playwright test "$@")
