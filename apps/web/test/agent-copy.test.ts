import { afterEach, describe, expect, it, vi } from 'vitest'
import { injectAgentCopy, isCrawler, onRequest } from '../functions/s/[[path]]'

const API = 'https://api.test'
const ID = 'abcdefghij1234'
const SHELL = `<html><head><meta name="brief-api" content="${API}"/></head><body><div id="root"></div></body></html>`

function context(path: string, userAgent = 'curl/8.0') {
  return {
    request: new Request(`https://brief.test${path}`, { headers: { 'user-agent': userAgent } }),
    env: { ASSETS: { fetch: async () => new Response(SHELL, { headers: { 'content-type': 'text/html' } }) } },
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('isCrawler', () => {
  it.each(['Googlebot/2.1', 'GPTBot/1.0', 'ClaudeBot/1.0', 'CCBot/2.0', 'Baiduspider', 'Yahoo! Slurp'])(
    'flags %s',
    (ua) => expect(isCrawler(ua)).toBe(true),
  )
  it.each(['curl/8.0', 'Claude-User/1.0', 'ChatGPT-User/1.0', 'Mozilla/5.0 Firefox/130', null])(
    'lets %s through',
    (ua) => expect(isCrawler(ua)).toBe(false),
  )
})

describe('injectAgentCopy', () => {
  it('escapes the markdown and keeps $ sequences intact', () => {
    const html = injectAgentCopy(SHELL, `${API}/raw`, '# T\n$$x$$ $& <script>alert(1)</script>')
    expect(html).toContain('$$x$$ $&amp; &lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)')
    expect(html).toContain(`<link rel="alternate" type="text/markdown" href="${API}/raw"/></head>`)
  })
})

describe('onRequest', () => {
  it('embeds the raw markdown for a non-crawler', async () => {
    const fetchMock = vi.fn(async () => new Response('# Hello doc'))
    vi.stubGlobal('fetch', fetchMock)
    const res = await onRequest(context(`/s/${ID}/`))
    expect(fetchMock).toHaveBeenCalledWith(`${API}/api/session/${ID}/raw`)
    expect(await res.text()).toContain('<pre># Hello doc</pre>')
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })

  it('serves the bare shell to a crawler without calling the API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = await onRequest(context(`/s/${ID}`, 'Mozilla/5.0 (compatible; GPTBot/1.0)'))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await res.text()).toBe(SHELL)
  })

  it.each([403, 404, 500])('falls back to the shell when /raw answers %i', async (status) => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status }))
    expect(await (await onRequest(context(`/s/${ID}`))).text()).toBe(SHELL)
  })

  it('falls back to the shell when the API is unreachable', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('network')
    })
    expect(await (await onRequest(context(`/s/${ID}`))).text()).toBe(SHELL)
  })

  it('serves the shell for a malformed id', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await (await onRequest(context('/s/short'))).text()).toBe(SHELL)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
