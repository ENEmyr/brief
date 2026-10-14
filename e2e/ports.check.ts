import assert from 'node:assert/strict'
import { e2ePorts, portBaseForRoot } from './ports'

// Run with `bun run ports:check` (from e2e/) or `bun e2e/ports.check.ts`.
const a = portBaseForRoot('/home/enemy/Repository/interactive-docs')
const b = portBaseForRoot('/home/enemy/Repository/interactive-docs-wt/test-console-e2e-ports')
const c = portBaseForRoot('/home/enemy/Repository/interactive-docs-wt/feat-console-phase4a')
assert.equal(portBaseForRoot('/x/y'), portBaseForRoot('/x/y'), 'derivation is stable')
assert.equal(new Set([a, b, c]).size, 3, 'distinct repo roots map to distinct bases')
for (const base of [a, b, c]) {
  assert.ok(base >= 20000 && base + 7 < 28000 && base % 8 === 0, `base ${base} is a slot in 20000..27999`)
}

const ci = e2ePorts({ CI: 'true' })
assert.deepEqual([ci.api, ci.web, ci.visualWeb], [8787, 8788, 8789], 'CI keeps 8787, 8788, 8789')
assert.deepEqual(
  [ci.apiInspector, ci.webInspector, ci.visualInspector],
  [8791, 8792, 8793],
  'inspector ports sit above the server ports',
)
assert.equal(e2ePorts({ E2E_PORT_BASE: '31000', CI: 'true' }).web, 31001, 'explicit base wins over CI')
assert.throws(() => e2ePorts({ E2E_PORT_BASE: 'abc' }), /E2E_PORT_BASE/)
console.log('ports ok')
