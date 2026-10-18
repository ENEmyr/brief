import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { basePorts, claimPortBase, e2ePorts, isPortBusy, portBaseForRoot, slotBase } from './ports'

// Run with `bun run ports:check` (from e2e/), `bun run test --filter=@brief/e2e`
// or `bun e2e/ports.check.ts`. Roots are synthetic: nothing here reads a real path.
const a = portBaseForRoot('/synthetic/main')
const b = portBaseForRoot('/synthetic/wt/ports')
const c = portBaseForRoot('/synthetic/wt/phase4a')
assert.equal(portBaseForRoot('/x/y'), portBaseForRoot('/x/y'), 'derivation is stable')
assert.equal(new Set([a, b, c]).size, 3, 'distinct synthetic roots map to distinct bases')
for (const base of [a, b, c]) {
  assert.ok(
    base >= 10000 && base + 7 <= 32767 && base % 8 === 0,
    `base ${base} is a slot in 10000..32767`,
  )
}
assert.equal(slotBase(-1), 32760, 'slots wrap below the first')
assert.equal(slotBase(2846), 10000, 'slots wrap past the last')

const ci = e2ePorts({ CI: 'true' })
assert.deepEqual([ci.api, ci.web, ci.visualWeb], [8787, 8788, 8789], 'CI keeps 8787, 8788, 8789')
assert.deepEqual(
  [ci.apiInspector, ci.webInspector, ci.visualInspector],
  [8791, 8792, 8793],
  'inspector ports sit above the server ports',
)
assert.equal(
  e2ePorts({ E2E_PORT_BASE: '31000', CI: 'true' }).web,
  31001,
  'explicit base wins over CI',
)
assert.throws(() => e2ePorts({ E2E_PORT_BASE: 'abc' }), /E2E_PORT_BASE/)

const root = '/synthetic/wt/ports'
const busyOn = (ports: number[]) => async (port: number) => ports.includes(port)
const messages: string[] = []
const claim = (env: NodeJS.ProcessEnv, busy: (port: number) => Promise<boolean>, root: string) =>
  claimPortBase(env, busy, root, (m) => messages.push(m))
const owned = (base: number) => basePorts(base)

assert.equal(await claim({}, busyOn([]), root), b, 'a free slot is used as derived')
for (const [label, offset] of [
  ['api', 0],
  ['web', 1],
  ['visual web', 2],
  ['api inspector', 4],
  ['web inspector', 5],
  ['visual inspector', 6],
] as const) {
  assert.equal(
    await claim({}, busyOn([b + offset]), root),
    b + 8,
    `a busy ${label} port moves to the next slot`,
  )
}
assert.equal(
  await claim({}, busyOn([...owned(b), ...owned(b + 8)]), root),
  b + 16,
  'consecutive busy slots are all skipped',
)
assert.equal(await claim({ CI: 'true' }, busyOn(owned(8787)), root), 8787, 'CI is never probed')
await assert.rejects(
  claim({ E2E_PORT_BASE: String(b) }, busyOn([b + 1]), root),
  /already in use/,
  'an explicit base is never moved',
)
assert.equal(
  await claim({ E2E_PORT_BASE: String(b) }, busyOn([]), root),
  b,
  'a free explicit base is kept',
)
await assert.rejects(
  claim({}, async () => true, root),
  /no free port slot/,
  'every slot taken fails',
)

assert.ok(
  messages.some((m) => m.includes(`slot ${b} skipped, port ${b} is already in use`)),
  'the skip names the slot and port',
)

// One real listener: the probe sees a bound port and a released one.
const listener = createServer()
await new Promise<void>((done) => listener.listen(0, done))
const taken = (listener.address() as { port: number }).port
assert.equal(await isPortBusy(taken), true, 'a bound port is busy')
await new Promise((done) => listener.close(done))
assert.equal(await isPortBusy(taken), false, 'a released port is free')
console.log('ports ok')
