import type { Element, Root } from 'hast'
import type { BundledLanguage, GrammarState, Highlighter } from 'shiki'

// Lazy singleton: the `shiki` package (~1-2MB with bundled grammars) must
// never land in the app's first-load JS. The `import('shiki')` below is a
// dynamic import inside a function body, which Next's bundler always splits
// into its own async chunk; the `import type` above is erased entirely at
// compile time and carries no runtime cost. See task-5-report.md for the
// bundle-check evidence.
let highlighterPromise: Promise<Highlighter> | null = null

// 'text'/'plaintext' are shiki built-ins that never need loadLanguage.
const loadedLanguages = new Set<string>(['text', 'plaintext'])

// Token colors are CSS variables (--shiki-*, mapped to the Console tokens in
// globals.css), so one highlight pass follows light, dark and print.
const THEME_NAME = 'console'

async function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= import('shiki').then(({ createHighlighter, createCssVariablesTheme }) =>
    createHighlighter({
      themes: [createCssVariablesTheme({ name: THEME_NAME, variablePrefix: '--shiki-' })],
      langs: [],
    }),
  )
  return highlighterPromise
}

async function resolveLanguage(highlighter: Highlighter, lang: string): Promise<string> {
  if (loadedLanguages.has(lang)) return lang
  try {
    // Bundled language ids are an open string set at this call site (payload
    // `language` is a free-text label, not an enum) — shiki throws for
    // anything it doesn't recognize, which is exactly the "unknown language"
    // case this falls back from.
    await highlighter.loadLanguage(lang as BundledLanguage)
    loadedLanguages.add(lang)
    return lang
  } catch {
    return 'text'
  }
}

// Highlighting runs on the main thread, and the payload size cap (MAX_PAYLOAD_BYTES, about
// 1.9 MB) allows code that takes many seconds to tokenize. Two bounds keep each synchronous
// stretch short. A line longer than MAX_LINE_LENGTH renders as one plain span: some grammars
// are superlinear in line length (20,000 "[" as markdown takes over 1 s), and a cap by length
// stays the same on every device, unlike a time limit. Under the cap, the code is tokenized in
// chunks of about CHUNK_CHARS characters, with a yield to the event loop between chunks. Each
// chunk starts from the grammar state the previous one ended in, so the tree is the same as
// one pass. The total work still grows with the code size.
const MAX_LINE_LENGTH = 2000
const CHUNK_CHARS = 4000

async function renderInChunks(highlighter: Highlighter, code: string, lang: string): Promise<Root> {
  const lines = code.split(/\r?\n/)
  let root: Root | undefined
  let grammarState: GrammarState | undefined
  let start = 0
  while (start < lines.length) {
    let end = start
    let size = 0
    while (end < lines.length && (end === start || size + lines[end]!.length < CHUNK_CHARS)) {
      size += lines[end]!.length + 1
      end += 1
    }
    // tokenizeTimeLimit 0 turns off shiki's 500 ms per-line budget: past it the rest of a line
    // renders uncolored, which on a slow device is a visible defect.
    const part = highlighter.codeToHast(lines.slice(start, end).join('\n'), {
      lang: lang as BundledLanguage,
      theme: THEME_NAME,
      tokenizeTimeLimit: 0,
      tokenizeMaxLineLength: MAX_LINE_LENGTH,
      grammarState,
    })
    grammarState = highlighter.getLastGrammarState(part)
    if (root) codeElement(root).children.push({ type: 'text', value: '\n' }, ...codeElement(part).children)
    else root = part
    start = end
    if (start < lines.length) await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return root!
}

// codeToHast always returns root > pre > code, with the lines as the code's children.
const codeElement = (root: Root) => (root.children[0] as Element).children[0] as Element

/**
 * Highlights `code` as `lang` into a hast tree with the css-variables theme
 * above. Never throws: an unrecognized language degrades to plaintext, and
 * any other failure degrades to a plain (uncolored) shiki plaintext render.
 *
 * Returns the hast tree rather than an HTML string (codeToHast, not
 * codeToHtml) so CodePre can render it as real React elements — see CodePre
 * for why the code body can no longer go through dangerouslySetInnerHTML.
 */
export async function highlightToHast(code: string, lang: string): Promise<Root> {
  const highlighter = await getHighlighter()
  const resolvedLang = await resolveLanguage(highlighter, lang)

  try {
    return await renderInChunks(highlighter, code, resolvedLang)
  } catch {
    // Belt-and-suspenders beyond resolveLanguage's own try/catch: some
    // languages load successfully but still fail to render for a given
    // code sample. Fall back to plaintext rather than throwing.
    return highlighter.codeToHast(code, { lang: 'text', theme: THEME_NAME })
  }
}
