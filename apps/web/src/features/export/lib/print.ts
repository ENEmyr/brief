import { setThemePrintOverride, whenThemedRendersIdle } from '@/features/theme'

/**
 * Printing is an export path, not a topbar detail: "give me this doc as a
 * file" is the same reader intent as the markdown download, so it lives
 * beside download.ts and reaches the UI through ExportProvider rather than
 * as an inline window.print() stranded in Topbar.
 *
 * Most of the paper rendering is CSS (the `@media print` block in
 * app/globals.css): light theme, no chrome, no pan/zoom transform, details
 * forced open. That CSS-only approach does not reach mermaid diagrams or
 * echarts charts, though -- both pick their colors in JS, keyed off the app
 * theme, and never see the print media query. Printed from the mocha theme
 * they came out with near-white text/gridlines on the page the print
 * stylesheet had just forced to white. See features/theme's
 * setThemePrintOverride/beginThemedRender for the mechanism this uses to
 * force those two renderers to the latte palette for the duration of one
 * print.
 */

const GRACE_FRAME = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const GRACE_TICK = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
/** Upper bound on how long printDocument will hold the print dialog for
 *  charts/diagrams to finish redrawing in the forced palette. Past this, we
 *  print anyway rather than let a stuck render hang the dialog forever --
 *  see the reliability note below. */
const MAX_WAIT_MS = 2000

/**
 * Best-effort wait for every mounted chart/diagram to finish redrawing after
 * a theme flip. `whenThemedRendersIdle` is event-driven -- it resolves the
 * instant the last in-flight render's `beginThemedRender()` counter hits
 * zero, or immediately if none is in flight -- but immediately after
 * `setThemePrintOverride` runs, none may be in flight YET: React has not
 * necessarily committed the resulting re-render (passive effects, which is
 * what useEChart and MermaidBlock use, are flushed by React on their own
 * schedule after the next paint, not synchronously). Calling
 * whenThemedRendersIdle() before that commit would see zero pending renders
 * and resolve immediately, before any of them even started. The one rAF plus
 * one macrotask below is a grace period for that commit-and-start to happen;
 * only after it do we actually wait on whenThemedRendersIdle(), raced
 * against MAX_WAIT_MS so a render that never settles can't hang the print
 * dialog indefinitely.
 *
 * RELIABILITY NOTE (disclosed, not hidden): this is a heuristic, not a
 * guarantee. It is covered by unit tests (test/export/export.test's
 * `printDocument` describe block, and test/reader/echarts-service.test /
 * mermaid-print-sync.test for the begin/end counter itself) that exercise
 * the sequencing this relies on, but those run in jsdom, which has no real
 * layout/paint/print pipeline -- this has NOT been confirmed against an
 * actual print dialog in a real browser.
 * There is also no OS-level "print is about to capture the page" hook to
 * synchronize against instead -- window.print() blocks script execution once
 * called in every evergreen engine, so all of this must happen BEFORE that
 * call, and nothing here can prove React's passive-effect flush lands inside
 * the grace period on an unusually loaded main thread (a great many heavy
 * diagrams, a slow device). In that case the print snapshot could still
 * capture the last diagram a frame before its redraw lands. We chose to ship
 * this best-effort wait, disclosed, over either shipping the old silent-
 * wrong-color PDF or blocking print indefinitely on a render that never
 * settles.
 */
async function waitForThemedPrintRenders(): Promise<void> {
  await GRACE_FRAME()
  await GRACE_TICK()
  await Promise.race([whenThemedRendersIdle(), new Promise<void>((resolve) => setTimeout(resolve, MAX_WAIT_MS))])
}

export async function printDocument(): Promise<void> {
  const isMocha = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'mocha'
  if (!isMocha) {
    window.print()
    return
  }

  setThemePrintOverride('latte')
  try {
    await waitForThemedPrintRenders()
    window.print()
  } finally {
    // Runs once window.print() returns. That is synchronous-blocking in
    // every evergreen engine, so this restores the user's real theme right
    // as the print dialog closes, not before the print snapshot was taken.
    setThemePrintOverride(null)
  }
}
