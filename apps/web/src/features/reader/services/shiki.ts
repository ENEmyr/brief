import type { BundledLanguage, Highlighter, ShikiTransformer } from 'shiki'

// Lazy singleton: the `shiki` package (~1-2MB with bundled grammars) must
// never land in the app's first-load JS. The `import('shiki')` below is a
// dynamic import inside a function body, which Next's bundler always splits
// into its own async chunk; the `import type` above is erased entirely at
// compile time and carries no runtime cost. See task-5-report.md for the
// bundle-check evidence.
let highlighterPromise: Promise<Highlighter> | null = null

// 'text'/'plaintext' are shiki built-ins that never need loadLanguage.
const loadedLanguages = new Set<string>(['text', 'plaintext'])

async function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= import('shiki').then(({ createHighlighter }) =>
    createHighlighter({ themes: ['catppuccin-mocha'], langs: [] }),
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

export interface HighlightOptions {
  /** 1-based line numbers to mark with the `.hl-line` class. */
  highlightLines?: number[]
}

/**
 * Highlights `code` as `lang` using the Catppuccin Mocha shiki theme
 * (deliberately the SAME theme regardless of the app's own light/dark
 * setting — the prototype renders a dark code panel in both themes; see
 * globals.css `--code-bg` for how the panel shade itself still differs
 * between latte/mocha even though the syntax theme doesn't). Never throws:
 * an unrecognized language degrades to plaintext, and any other failure
 * degrades to a plain (uncolored) shiki plaintext render.
 */
export async function highlight(code: string, lang: string, options: HighlightOptions = {}): Promise<string> {
  const highlighter = await getHighlighter()
  const highlightSet = new Set(options.highlightLines ?? [])
  const resolvedLang = await resolveLanguage(highlighter, lang)

  const highlightLinesTransformer: ShikiTransformer = {
    line(node, line) {
      if (highlightSet.has(line)) this.addClassToHast(node, 'hl-line')
    },
  }

  const render = (renderLang: string) =>
    highlighter.codeToHtml(code, {
      lang: renderLang as BundledLanguage,
      theme: 'catppuccin-mocha',
      transformers: highlightSet.size ? [highlightLinesTransformer] : [],
    })

  try {
    return render(resolvedLang)
  } catch {
    // Belt-and-suspenders beyond resolveLanguage's own try/catch: some
    // languages load successfully but still fail to render for a given
    // code sample. Fall back to plaintext rather than throwing.
    return render('text')
  }
}
