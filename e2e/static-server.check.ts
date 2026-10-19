import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStaticServer, parseRedirects } from './static-server'

// Run with `bun static-server.check.ts` (from e2e/) or `bun run test --filter=@brief/e2e`.
// The fixture is a synthetic export in a temp dir, so no web build is needed.
const dir = mkdtempSync(join(tmpdir(), 'static-server-check-'))
const root = join(dir, 'out')
const files: Record<string, string> = {
  'index.html': 'home page',
  's/index.html': 'reader page',
  '404.html': 'not found page',
  'docs/index.html': 'docs page',
  '_next/static/app.js': 'console.log(1)',
  _redirects: '# reader route\n/s/* /s/ 200\n',
}
for (const [path, body] of Object.entries(files)) {
  mkdirSync(join(root, path, '..'), { recursive: true })
  writeFileSync(join(root, path), body)
}
writeFileSync(join(dir, 'secret.txt'), 'outside the root')

const server = createStaticServer(root).listen(0)
await new Promise((done) => server.once('listening', done))
const origin = `http://localhost:${(server.address() as AddressInfo).port}`
const get = (path: string) => fetch(`${origin}${path}`, { redirect: 'manual' })

try {
  const reader = await get('/s/abc')
  assert.equal(reader.status, 200, '/s/abc is rewritten, not redirected')
  assert.equal(await reader.text(), 'reader page', '/s/abc serves the /s/ page')

  assert.equal(await (await get('/s/')).text(), 'reader page', '/s/ serves its index.html')

  const missing = await get('/missing')
  assert.equal(missing.status, 404, 'a missing path is a 404')
  assert.equal(await missing.text(), 'not found page', 'a missing path serves 404.html')

  const home = await get('/')
  assert.equal(home.status, 200)
  assert.equal(await home.text(), 'home page', '/ serves index.html')
  assert.equal(home.headers.get('content-type'), 'text/html; charset=utf-8')

  const js = await get('/_next/static/app.js')
  assert.equal(js.status, 200)
  assert.equal(js.headers.get('content-type'), 'application/javascript', '.js has its content type')

  const bare = await get('/docs?x=1')
  assert.equal(bare.status, 308, '/docs redirects to its directory, as Pages does')
  assert.equal(bare.headers.get('location'), '/docs/?x=1')

  const escape = await get('/..%2Fsecret.txt')
  assert.equal(escape.status, 404, 'an encoded ../ cannot read outside the root')

  assert.equal(
    (await fetch(`${origin}/`, { method: 'POST' })).status,
    405,
    'only GET and HEAD are served',
  )
} finally {
  server.close()
}

assert.deepEqual(parseRedirects('/s/* /s/ 200\n\n# c\n/a /b 200'), [
  { prefix: '/s/', splat: true, to: '/s/' },
  { prefix: '/a', splat: false, to: '/b' },
])
assert.throws(() => parseRedirects('/old /new 301'), /line 1/, 'a non-200 rule fails loudly')
assert.throws(() => parseRedirects('/a/:id /b/:id 200'), /line 1/, 'a placeholder fails loudly')
assert.throws(() => parseRedirects('/a /b'), /line 1/, 'a rule without a status fails loudly')

writeFileSync(join(root, '_headers'), '/*\n  X-Test: 1\n')
assert.throws(
  () => createStaticServer(root),
  /_headers/,
  'a _headers file it cannot apply fails loudly',
)

rmSync(dir, { recursive: true, force: true })
console.log('static-server checks passed')
