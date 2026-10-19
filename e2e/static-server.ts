import { existsSync, readFileSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// Serves the Next static export (apps/web/out) to the e2e and visual suites in
// place of `wrangler pages dev`, whose miniflare ProxyWorker dropped connections
// under repeated runs. It follows the Pages asset handler for the routes the app
// uses: a 200 rewrite from _redirects first, then the file, dir/index.html or
// name.html, a 308 from /dir to /dir/, and 404.html with status 404 otherwise.
// shortcut: no ETag, caching or Pages default headers; add them if a spec needs them.

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
}

export interface Rewrite {
  prefix: string
  splat: boolean
  to: string
}

// Only the `/from[*] /to 200` form is understood; anything else would be
// silently ignored here but honoured in production, so it throws.
export function parseRedirects(text: string): Rewrite[] {
  return text.split('\n').flatMap((raw, index) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return []
    const [from = '', to = '', status, ...rest] = line.split(/\s+/)
    const splat = from.endsWith('*')
    const prefix = splat ? from.slice(0, -1) : from
    const plain = (path: string) => path.startsWith('/') && !/[*:]/.test(path)
    if (status !== '200' || rest.length > 0 || !plain(prefix) || !plain(to)) {
      throw new Error(
        `_redirects line ${index + 1}: only "/from[*] /to 200" is supported, got "${line}"`,
      )
    }
    return [{ prefix, splat, to }]
  })
}

export function createStaticServer(dir: string): Server {
  const root = resolve(dir)
  if (existsSync(join(root, '_headers'))) {
    throw new Error(
      `${join(root, '_headers')} exists, but the e2e static server does not apply _headers`,
    )
  }
  const redirects = join(root, '_redirects')
  const rewrites = existsSync(redirects) ? parseRedirects(readFileSync(redirects, 'utf8')) : []

  async function fileAt(path: string): Promise<string | null> {
    const full = join(root, path)
    if (!full.startsWith(root + sep)) return null
    try {
      return (await stat(full)).isFile() ? full : null
    } catch {
      return null
    }
  }

  async function send(req: IncomingMessage, res: ServerResponse, status: number, file: string) {
    const body = await readFile(file)
    res.writeHead(status, {
      'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
      'content-length': body.length,
    })
    res.end(req.method === 'HEAD' ? undefined : body)
  }

  async function respond(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end()
      return
    }
    const url = new URL(req.url ?? '/', 'http://localhost')
    const rule = rewrites.find((r) =>
      r.splat ? url.pathname.startsWith(r.prefix) : url.pathname === r.prefix,
    )
    let pathname = rule ? rule.to : url.pathname
    try {
      pathname = decodeURIComponent(pathname)
    } catch {
      // Pages keeps a path it cannot decode as it is.
    }
    const candidates = pathname.endsWith('/')
      ? [`${pathname}index.html`]
      : [pathname, `${pathname}.html`]
    for (const candidate of candidates) {
      const file = await fileAt(candidate)
      if (file) return send(req, res, 200, file)
    }
    if (!pathname.endsWith('/') && (await fileAt(`${pathname}/index.html`))) {
      res.writeHead(308, { location: `${pathname}/${url.search}` }).end()
      return
    }
    const notFound = await fileAt('/404.html')
    if (notFound) return send(req, res, 404, notFound)
    res.writeHead(404).end()
  }

  return createServer((req, res) => {
    respond(req, res).catch((error: unknown) => {
      console.error(error)
      if (!res.headersSent) res.writeHead(500)
      res.end()
    })
  })
}

// `bun static-server.ts <dir> <port>` serves <dir> on <port>.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dir, port] = process.argv.slice(2)
  if (!dir || !port) {
    console.error('usage: bun static-server.ts <dir> <port>')
    process.exit(2)
  }
  createStaticServer(dir).listen(Number(port), () => {
    console.log(`static-server: serving ${resolve(dir)} on http://localhost:${port}`)
  })
}
