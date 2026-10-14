#!/usr/bin/env bash
# Console visual suite.
#   run.sh        build apps/web, then compare the app against e2e/visual/reference/
#   run.sh refs   render e2e/visual/reference/ from the design boards
# The API is never started (every call is answered with page.route), so unlike
# e2e/run.sh there are no D1 migrations. SKIP_BUILD=1 reuses apps/web/out.
set -euo pipefail
unset CDPATH

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
# Ports come from ports.ts so run.sh and visual.config.ts always agree.
# Assign before eval: `eval "$(...)"` would hide a failing ports.ts behind eval's own status.
PORT_EXPORTS="$(bun "${SCRIPT_DIR}/../ports.ts")"
eval "$PORT_EXPORTS"
echo "==> Ports: visual web ${VISUAL_WEB_URL}, baked API ${API_URL} (E2E_PORT_BASE=${E2E_PORT_BASE})"

mode="visual"
if [ "${1:-}" = "refs" ]; then
  mode="refs"
  shift
fi

for arg in "$@"; do
  case "$arg" in
    -u | --update-snapshots*)
      echo "The visual suite never updates snapshots; re-render the references with: bun run e2e:visual:refs" >&2
      exit 2
      ;;
  esac
done

if [ "$mode" = "refs" ]; then
  (cd "${SCRIPT_DIR}/.." && bunx playwright test -c visual/references.config.ts "$@")
  exit 0
fi

if [ "${SKIP_BUILD:-}" != "1" ]; then
  echo "==> Building apps/web (NEXT_PUBLIC_API_URL=${API_URL})"
  (cd "${ROOT_DIR}/apps/web" && NEXT_PUBLIC_API_URL="${API_URL}" bun run build)
fi

echo "==> Running the Console visual suite"
(cd "${SCRIPT_DIR}/.." && bunx playwright test -c visual/visual.config.ts "$@")
