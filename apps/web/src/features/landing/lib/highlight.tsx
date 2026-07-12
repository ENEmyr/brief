import { Fragment, type ReactNode } from 'react'

/**
 * A two-language colorizer for the landing page's static snippets.
 *
 * The reader highlights code with Shiki, which is loaded lazily because it is
 * heavy (apps/web/CLAUDE.md). The landing page is the cheapest page on the
 * site and its snippets never change at runtime, so it pays for its colour
 * with a regex instead of a grammar. Colours are fixed Mocha hexes rather than
 * semantic tokens because the code surface (--code-bg) is dark under both
 * themes, and the light-theme accents would be unreadable on it.
 */
const KEY = 'text-[#89b4fa]'
const STRING = 'text-[#a6e3a1]'
const NUMBER = 'text-[#fab387]'
const KEYWORD = 'text-[#cba6f7]'
const COMMENT = 'text-[#7f849c]'
const PUNCT = 'text-[#9399b2]'

const JSON_STRING = /"(?:[^"\\]|\\.)*"/
const JSON_TOKEN = new RegExp(
  String.raw`${JSON_STRING.source}(?:\s*:)?|-?\d+(?:\.\d+)?|true|false|null`,
  'g',
)
const JSON_KEY = new RegExp(String.raw`^(${JSON_STRING.source})(\s*:)$`)
const SHELL_STRING = /'[^']*'|"[^"]*"/g

type MatchRenderer = (match: RegExpExecArray, key: string) => ReactNode

/**
 * Walks a line once, emitting the unmatched runs as plain spans and handing
 * each match to the language's renderer. Both languages colour a line the same
 * way and differ only in what a match means, so only the renderer varies.
 */
function scan(line: string, token: RegExp, lineKey: string, render: MatchRenderer): ReactNode[] {
  const parts: ReactNode[] = []
  let last = 0

  for (const match of line.matchAll(token)) {
    const start = match.index
    if (start > last) parts.push(<span key={`${lineKey}-t${last}`}>{line.slice(last, start)}</span>)
    parts.push(render(match, `${lineKey}-m${start}`))
    last = start + match[0].length
  }

  if (last < line.length) parts.push(<span key={`${lineKey}-t${last}`}>{line.slice(last)}</span>)
  return parts
}

function jsonToken(match: RegExpExecArray, key: string): ReactNode {
  const raw = match[0]
  const asKey = JSON_KEY.exec(raw)

  if (asKey) {
    const [, name, colon] = asKey
    return (
      <Fragment key={key}>
        <span className={KEY}>{name}</span>
        <span className={PUNCT}>{colon}</span>
      </Fragment>
    )
  }

  let className = KEYWORD
  if (raw.startsWith('"')) className = STRING
  else if (raw !== 'true' && raw !== 'false' && raw !== 'null') className = NUMBER

  return (
    <span key={key} className={className}>
      {raw}
    </span>
  )
}

function shellToken(match: RegExpExecArray, key: string): ReactNode {
  return (
    <span key={key} className={STRING}>
      {match[0]}
    </span>
  )
}

function jsonLine(line: string, lineKey: string): ReactNode {
  return scan(line, JSON_TOKEN, lineKey, jsonToken)
}

function shellLine(line: string, lineKey: string): ReactNode {
  if (line.trimStart().startsWith('#')) {
    return <span className={COMMENT}>{line}</span>
  }
  return scan(line, SHELL_STRING, lineKey, shellToken)
}

export function highlight(code: string, language: 'json' | 'shell'): ReactNode {
  const renderLine = language === 'json' ? jsonLine : shellLine
  return code.split('\n').map((line, index) => {
    const lineKey = `l${index}`
    return (
      <span key={lineKey} className="block min-h-[1.5em]">
        {renderLine(line, lineKey)}
      </span>
    )
  })
}
