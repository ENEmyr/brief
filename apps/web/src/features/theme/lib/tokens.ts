import type { Theme } from '../hooks/useTheme'

/**
 * Reads the `--c-<name>` colors globals.css defines for `theme`, for renderers
 * that cannot use var() (echarts draws on a canvas, mermaid measures in its
 * own detached DOM). The probe carries its own data-theme, so a print can ask
 * for light values while the page is dark. Client only: call it from effects
 * and event handlers, never during render (the static export pre-renders).
 */
export function readColorTokens<const N extends string>(theme: Theme, names: readonly N[]): Record<N, string> {
  const probe = document.createElement('div')
  probe.setAttribute('data-theme', theme)
  probe.hidden = true
  document.body.append(probe)
  const style = getComputedStyle(probe)
  const values = Object.fromEntries(names.map((name) => [name, style.getPropertyValue(`--c-${name}`).trim()]))
  probe.remove()
  return values as Record<N, string>
}

/**
 * The font-family list for text drawn outside CSS (canvas, mermaid). It
 * mirrors --font-sans / --font-mono in globals.css, resolved from the font
 * variables on :root (app/fonts.css), because a canvas font string cannot hold var().
 */
export function readFontStack(kind: 'sans' | 'mono'): string {
  const root = getComputedStyle(document.documentElement)
  const latin = root.getPropertyValue(kind === 'sans' ? '--font-geist' : '--font-geist-mono').trim()
  const thai = root.getPropertyValue('--font-noto-thai').trim()
  const generic = kind === 'sans' ? 'ui-sans-serif, system-ui, sans-serif' : 'ui-monospace, monospace'
  return [latin, thai, generic].filter(Boolean).join(', ')
}
