import { realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// One env var, E2E_PORT_BASE, places every local server the e2e and visual
// suites start: API = base, web = base + 1, visual web = base + 2. Each wrangler
// process also opens a devtools inspector (default 9229, and two processes that
// start together race for the next free port and one dies), so those get fixed
// ports too: API base + 4, web base + 5, visual web base + 6.
// CI keeps 8787/8788/8789. Locally each checkout derives its own base from its
// absolute path, so concurrent worktrees never share a server.
const CI_PORT_BASE = 8787
const LOCAL_PORT_FLOOR = 20000
const LOCAL_SLOTS = 1000
const SLOT_WIDTH = 8

// FNV-1a, 32 bit.
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

export function portBaseForRoot(repoRoot: string): number {
  return LOCAL_PORT_FLOOR + (hash(repoRoot) % LOCAL_SLOTS) * SLOT_WIDTH
}

export function repoRoot(): string {
  return realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'))
}

export function resolvePortBase(env: NodeJS.ProcessEnv = process.env): number {
  const explicit = env.E2E_PORT_BASE
  if (explicit) {
    const base = Number(explicit)
    if (!Number.isInteger(base) || base < 1024 || base > 65000) {
      throw new Error(`E2E_PORT_BASE must be an integer from 1024 to 65000, got "${explicit}"`)
    }
    return base
  }
  return env.CI ? CI_PORT_BASE : portBaseForRoot(repoRoot())
}

export function e2ePorts(env: NodeJS.ProcessEnv = process.env) {
  const base = resolvePortBase(env)
  return {
    base,
    api: base,
    web: base + 1,
    visualWeb: base + 2,
    apiInspector: base + 4,
    webInspector: base + 5,
    visualInspector: base + 6,
    apiUrl: `http://localhost:${base}`,
    webUrl: `http://localhost:${base + 1}`,
    visualWebUrl: `http://localhost:${base + 2}`,
  }
}

// `bun e2e/ports.ts` prints shell exports for run.sh to eval.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const p = e2ePorts()
  console.log(`export E2E_PORT_BASE=${p.base}`)
  console.log(`export API_URL=${p.apiUrl}`)
  console.log(`export WEB_URL=${p.webUrl}`)
  console.log(`export VISUAL_WEB_URL=${p.visualWebUrl}`)
}
