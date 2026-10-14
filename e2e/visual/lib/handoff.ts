import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import type { AddressInfo } from 'node:net'

/** Where the design handoff lives. Never copied into the repo. */
export const HANDOFF_DIR =
  process.env.BRIEF_HANDOFF_DIR ?? '/home/enemy/Repository/interactive-docs/.design-handoff/console'
export const BOARDS_DIR = path.join(HANDOFF_DIR, 'boards')
export const LIGHTIFY = path.join(HANDOFF_DIR, 'tools', 'lightify.py')

export const REFERENCE_DIR = path.resolve(import.meta.dirname, '..', 'reference')
/** Generated boards (the lightified landing) live here, inside the gitignored reference folder. */
export const GENERATED_DIR = path.join(REFERENCE_DIR, '.generated')

/** Row B boards in the handoff folder. Rows A and C are rejected alternatives. */
export function rowBBoards(): string[] {
  return fs
    .readdirSync(BOARDS_DIR)
    .filter((f) => /^B-.*\.dc\.html$/.test(f))
    .map((f) => f.replace('.dc.html', ''))
    .sort()
}

export function boardWidth(board: string): number {
  const canvas = JSON.parse(fs.readFileSync(path.join(BOARDS_DIR, 'canvas.json'), 'utf8')) as {
    boards: Record<string, { w: number }>
  }
  const entry = canvas.boards[`${board}.dc.html`]
  if (!entry) throw new Error(`${board} is not in canvas.json`)
  return entry.w
}

const MIME: Record<string, string> = {
  '.js': 'text/javascript',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
}

/**
 * Serves the boards over http (a file:// URL fails on the canvas runtime's
 * CORS fetch). Generated boards win over handoff boards of the same name.
 */
export async function serveBoards(): Promise<{ url: string; close: () => Promise<void> }> {
  const roots = [GENERATED_DIR, BOARDS_DIR]
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/')
    for (const root of roots) {
      const file = path.resolve(root, `.${rel}`)
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) continue
      res.setHeader('content-type', MIME[path.extname(file)] ?? 'application/octet-stream')
      res.end(fs.readFileSync(file))
      return
    }
    res.statusCode = 404
    res.end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
