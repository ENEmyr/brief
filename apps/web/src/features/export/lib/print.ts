/**
 * Printing is an export path, not a topbar detail: "give me this doc as a
 * file" is the same reader intent as the markdown download, so it lives
 * beside download.ts and reaches the UI through ExportProvider instead of an
 * inline window.print() stranded in Topbar.
 *
 * The paper rendering itself is entirely CSS (the `@media print` block in
 * app/globals.css): light theme, no chrome, no pan/zoom transform, details
 * forced open. Nothing to set up here, so this is a one-liner -- but a named
 * one, so the print surface is a seam the provider and the tests can hold on
 * to rather than a global call site.
 */
export function printDocument() {
  window.print()
}
