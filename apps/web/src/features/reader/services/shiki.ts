import type { Root } from 'hast'
import type { BundledLanguage, Highlighter } from 'shiki'

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

  // tokenizeTimeLimit 0 turns off shiki's 500 ms per-line budget: past it the rest of a line
  // renders uncolored, which on a slow device is a visible defect. The payload size cap bounds
  // the work, so a pathological line cannot run unbounded.
  const render = (renderLang: string) =>
    highlighter.codeToHast(code, {
      lang: renderLang as BundledLanguage,
      theme: THEME_NAME,
      tokenizeTimeLimit: 0,
    })

  try {
    return await render(resolvedLang)
  } catch {
    // Belt-and-suspenders beyond resolveLanguage's own try/catch: some
    // languages load successfully but still fail to render for a given
    // code sample. Fall back to plaintext rather than throwing.
    return render('text')
  }
}
