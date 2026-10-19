import { realpathSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// One env var, E2E_PORT_BASE, places every local server the e2e and visual
// suites start: API = base, web = base + 1, visual web = base + 2. The API runs
// under wrangler, which opens a devtools inspector (default 9229, and two
// processes that start together race for the next free port and one dies), so
// it gets a fixed port: API base + 4. The web servers run e2e/static-server.ts
// and open no inspector; base + 5 and base + 6 stay reserved for them.
// CI keeps 8787/8788/8789. Locally each checkout derives its own slot from its
// absolute path, so concurrent worktrees never share a server. Slots tile
// 10000..32767 (below Linux's ephemeral range from 32768), 2846 of them, so
// two of 11 worktrees share a slot 1.9 percent of the time, 13 2.7, 20 6.5.
// The CLI also probes the slot's ports and moves to the next free slot when an
// unrelated service holds one (see claimPortBase).
const CI_PORT_BASE = 8787
const LOCAL_PORT_FLOOR = 10000
const LOCAL_PORT_CEILING = 32768
const SLOT_WIDTH = 8
const LOCAL_SLOTS = Math.floor((LOCAL_PORT_CEILING - LOCAL_PORT_FLOOR) / SLOT_WIDTH)

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
  return slotBase(hash(repoRoot) % LOCAL_SLOTS)
}

export function slotBase(slot: number): number {
  return LOCAL_PORT_FLOOR + (((slot % LOCAL_SLOTS) + LOCAL_SLOTS) % LOCAL_SLOTS) * SLOT_WIDTH
}

export function repoRoot(): string {
  return realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'))
}

export function resolvePortBase(env: NodeJS.ProcessEnv = process.env, root?: string): number {
  const explicit = env.E2E_PORT_BASE
  if (explicit) {
    const base = Number(explicit)
    if (!Number.isInteger(base) || base < 1024 || base > 65000) {
      throw new Error(`E2E_PORT_BASE must be an integer from 1024 to 65000, got "${explicit}"`)
    }
    return base
  }
  return env.CI ? CI_PORT_BASE : portBaseForRoot(root ?? repoRoot())
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

export function basePorts(base: number): number[] {
  const p = e2ePorts({ E2E_PORT_BASE: String(base) })
  return [p.api, p.web, p.visualWeb, p.apiInspector, p.webInspector, p.visualInspector]
}

// True when anything listens on the port on any address: binding the wildcard
// address fails with EADDRINUSE if a socket holds the port on any interface.
export function isPortBusy(port: number): Promise<boolean> {
  return new Promise((done) => {
    const server = createServer()
    server.once('error', () => done(true))
    server.listen(port, () => server.close(() => done(false)))
  })
}

async function firstBusy(
  base: number,
  busy: (port: number) => Promise<boolean>,
): Promise<number | null> {
  for (const port of basePorts(base)) if (await busy(port)) return port
  return null
}

// The base a run uses. An explicit E2E_PORT_BASE is never moved: a busy port
// fails the run. CI keeps 8787. Otherwise the slot derived from the repo root is
// used, advancing to the next slot while any of its ports is taken.
export async function claimPortBase(
  env: NodeJS.ProcessEnv = process.env,
  busy: (port: number) => Promise<boolean> = isPortBusy,
  root?: string,
  log: (message: string) => void = console.error,
): Promise<number> {
  const base = resolvePortBase(env, root)
  if (env.E2E_PORT_BASE) {
    const taken = await firstBusy(base, busy)
    if (taken !== null) throw new Error(`E2E_PORT_BASE=${base}: port ${taken} is already in use`)
    return base
  }
  if (env.CI) return base
  const first = (base - LOCAL_PORT_FLOOR) / SLOT_WIDTH
  for (let i = 0; i < LOCAL_SLOTS; i++) {
    const candidate = slotBase(first + i)
    const taken = await firstBusy(candidate, busy)
    if (taken === null) return candidate
    log(`ports: slot ${candidate} skipped, port ${taken} is already in use`)
  }
  throw new Error('no free port slot found')
}

// `bun e2e/ports.ts` prints shell exports for run.sh to eval. Messages go to
// stderr so they reach the terminal instead of the eval.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let p
  try {
    p = e2ePorts({ ...process.env, E2E_PORT_BASE: String(await claimPortBase()) })
  } catch (error) {
    console.error(`ports: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
  console.log(`export E2E_PORT_BASE=${p.base}`)
  console.log(`export API_URL=${p.apiUrl}`)
  console.log(`export WEB_URL=${p.webUrl}`)
  console.log(`export VISUAL_WEB_URL=${p.visualWebUrl}`)
}
