// Cloudflare Pages Function for /s/<id>. The page is a static shell that loads the
// session with JavaScript, so curl and agent fetch tools saw no content. This puts the
// session's /raw markdown into the HTML for every client except crawlers, which keep
// getting the bare shell. The browser removes the copy before React hydrates.

const SESSION_PATH = /^\/s\/([0-9a-zA-Z]{14})\/?$/
const CRAWLER_UA = /bot|crawl|spider|slurp/i
const API_META = /<meta name="brief-api" content="([^"]+)"/

interface Context {
  request: Request
  env: { ASSETS: { fetch: (input: URL) => Promise<Response> } }
}

export function isCrawler(userAgent: string | null): boolean {
  return CRAWLER_UA.test(userAgent ?? '')
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function injectAgentCopy(shell: string, rawUrl: string, markdown: string): string {
  const href = escapeHtml(rawUrl)
  const link = `<link rel="alternate" type="text/markdown" href="${href}"/>`
  const copy =
    `<div id="brief-agent-copy"><p>Full document below. Markdown source: <a href="${href}">${href}</a></p>` +
    `<pre>${escapeHtml(markdown)}</pre></div>` +
    `<script>document.getElementById('brief-agent-copy').remove()</script>`
  // Function replacers: a string replacement would expand `$$` math and `$&` in the markdown.
  return shell.replace('</head>', () => `${link}</head>`).replace('</body>', () => `${copy}</body>`)
}

export async function onRequest({ request, env }: Context): Promise<Response> {
  const url = new URL(request.url)
  const shellRes = await env.ASSETS.fetch(new URL('/s/', url))
  const shell = await shellRes.text()
  const headers = new Headers(shellRes.headers)
  headers.delete('content-length')
  headers.delete('etag')
  headers.set('x-robots-tag', 'noindex, nofollow')
  const bare = () => new Response(shell, { status: shellRes.status, headers })

  const id = SESSION_PATH.exec(url.pathname)?.[1]
  const api = API_META.exec(shell)?.[1]
  if (!id || !api || isCrawler(request.headers.get('user-agent'))) return bare()

  const rawUrl = `${api}/api/session/${id}/raw`
  // A protected (403) or missing (404) session, or an API outage, falls back to the shell.
  const raw = await fetch(rawUrl).catch(() => null)
  if (!raw?.ok) return bare()
  return new Response(injectAgentCopy(shell, rawUrl, await raw.text()), { status: 200, headers })
}
