# Console visual suite

Measures the running app against the design boards (the "Console" handoff).
Everything here is test infrastructure; it is not part of `bun run e2e`, so the
normal gate stays green while the visual specs are red.

## Commands (repo root)

| command | does |
|---|---|
| `bun run e2e:visual:refs` | render `e2e/visual/reference/` from the boards |
| `bun run e2e:visual` | build `apps/web`, then compare the app with the references |
| `SKIP_BUILD=1 bun run e2e:visual -- <filter>` | reuse `apps/web/out`, run matching specs only |
| `bun e2e/visual/render-favicon.ts` | write `apps/web/public/favicon.ico` from `apps/web/src/app/icon.svg` |

Use Node 22 (`mise exec node@22.23.2 -- ...`). The renderer needs network on
first use for Google Fonts and refuses to write references if a font is missing.

## How it works

- `render-references.ts` reads the boards from `BRIEF_HANDOFF_DIR` (default
  `/home/enemy/Repository/interactive-docs/.design-handoff/console`), serves
  them over http, renders them in Playwright's Chromium at DPR 1 after the fonts
  loaded, and writes PNGs to `reference/` (gitignored, never committed). Board
  files are never copied into the repo. The lightified landing is generated into
  `reference/.generated/`.
- The app self-hosts its fonts (`apps/web/src/app/fonts.css` and the woff2
  files beside it, the files next/font/google downloaded at 9f256b6). The boards
  link Google Fonts; the renderer answers their `fonts.googleapis.com` request
  with that same CSS and their font requests with the same files, and aborts any
  other `fonts.gstatic.com` request. Neither a build nor a reference render
  downloads a font, and the boards get the files the app ships.
- Both sides refuse fallback fonts (`lib/fonts.ts`): the renderer needs Geist,
  Geist Mono, and Noto Sans Thai wherever Thai text is set in a stack that names
  it (`BOARD_FONTS`); the app side needs its next/font families (`APP_FONTS`,
  the same set since Phase 1).
  A missing family fails the run as a harness error, not as a pixel diff.
- `visual.config.ts` serves `apps/web/out` with `wrangler pages dev` on the visual port, `E2E_PORT_BASE + 2` (8789 in CI, a per-worktree port locally that moves to the next free slot when a port is taken; see `e2e/ports.ts`).
  The API is never started: `lib/session.ts` answers `GET /api/session/<id>` and
  the state endpoints with `page.route`, using `fixtures/brief-sample.payload.json`
  under session id `k2p9x4Qm7Zr1Ta` with a fixed `expiresAt`, freezes `Date` with
  `page.clock.setFixedTime`, and seeds reader state through `localStorage`
  (`fixtures/reader-state.seed.json`) before the page loads. Any other API call
  fails the spec.
- Theme follows the system on first visit, so the `dark` and `light` projects
  only set `colorScheme`.
- `toHaveScreenshot` uses `maxDiffPixelRatio` 0.002 and reads references from
  `reference/` (`snapshotPathTemplate`). When the image sizes differ Playwright
  reports the two sizes and no ratio; that is the honest result for a page of the
  wrong height, so specs never shrink to a fixed height to force a ratio.
- Regions and crops are cut out of a full-page render (`fullPage: true` with a
  `clip`) at the element's box measured at scroll 0 (`clipOf` in
  `lib/regions.ts`), on the board and in the app alike. An element screenshot
  would scroll the element into the 900 px viewport, drop the rows below it and
  catch sticky elements (top bar, dock) at their scrolled position.
- Renders of the references are byte-identical from run to run.
  `references.config.ts` starts Chromium with one raster thread, no partial
  raster and no checker imaging. Without those flags, about 4 to 7 of the 128
  images differed between two renders by up to 53 anti-aliased pixels (channel
  delta at most 2), even with the fonts served locally.

## Update guard

`updateSnapshots` is `none` and the config throws on `-u` and
`--update-snapshots`, because the CLI flag would otherwise override the config
and write the app's output over the design. `run.sh` refuses the flags too.
References change only by re-rendering the boards.

## Reference names

| file | what |
|---|---|
| `board-<Board>.png` | every row B board in full, at its canvas width |
| `reader-{dark,light}-{1440,1100,880}.png` | B-Reader and B-Reader-Light at that width, full page |
| `region-dark-{topbar,outline,s1,s2,s3,s4,dock}.png` | B-Reader regions at 1440 (selectors in `lib/regions.ts`) |
| `mobile-{dark,light}-{reading,sheet}.png` | the two phone screens, 388x768 (see `PHONE_SCREEN` in `lib/regions.ts`) |
| `landing-{dark,light}.png`, `print.png` | B-Landing (light via `tools/lightify.py`), B-Print |
| `landing-{dark,light}-{1440,390}-<region>.png` | B-Landing regions (`LANDING_REGIONS` in `lib/regions.ts`) |
| `favicon-{16,32,48}.png` | `apps/web/src/app/icon.svg` at each favicon size |
| `crop-<name>.png` | element crops listed in `crops.json` |

The B-Mobile frame is 390x844 with a 1px border and radius 36. The app screen is
the 388x798 area below the 44 px status bar, so the mobile spec runs at a 388x798
viewport and bottom-anchored elements (the bottom sheet) land where the frame
puts them. Both sides compare its top 768 rows: they end at the bottom of the
sheet's buttons ("open dock", "Copy prompt for agent") and leave out the last 30
rows, which hold only sheet padding plus the frame's rounded corners (about 580
backdrop pixels, 0.19% of the screen, nearly the whole 0.002 budget). The
renderer throws if a button crosses the crop's bottom edge.

## Adding an element crop

Append an entry to `crops.json` and run `bun run e2e:visual:refs`:

```json
{ "name": "blocks-stat", "board": "B-Blocks", "selector": "section", "nth": 1, "contains": "Peak RPS" }
```

- `board`: file name without `.dc.html`. The board is rendered at its canvas width.
- `selector`: a CSS selector; optional `hasText` / `hasNotText` filter it the way
  Playwright's `locator(selector, { hasText, hasNotText })` does (text matches
  every ancestor too, so combine them with `nth`).
- `nth`: zero-based index among the matches (default 0).
- `contains`: text the element must hold; the renderer throws if the board changed
  and the entry points at something else. Always set it.
- `visibleHeight`: the rows of the element the board shows, when its frame clips
  the rest. B-Overlays clips the Archive dialog at 446 (a 470 frame, the dialog
  24 down), and below that the crop would hold the figcaption. The spec cuts the
  app element to the same height.
- `snap`: moves the element down by less than a pixel first, so its top lands on
  a whole pixel (`snapToPixelRow`). Set it for elements in a flow document, where
  boxes start at whatever fraction the content above adds up to and text lands a
  pixel row apart from an otherwise identical render. The spec snaps the app
  element the same way before it cuts it.
- Output is `reference/crop-<name>.png`, cut out of the full board render at the
  element's box. To compare the app with it, add a spec that cuts the matching
  app element the same way: `toHaveScreenshot('crop-<name>.png', { fullPage: true,
  clip: await clipOf(locator) })`. Assert `toBeVisible()` on the locator first, as
  the region specs do, so a missing element fails with its selector instead of a
  timeout inside `clipOf`.

## Landing

`tests/landing.visual.spec.ts` compares the landing page with B-Landing and its
lightified copy region by region at 1440 and 390 (the board's own CSS switches at
879). Four differences are known, and each has a narrower cut that leaves it out:
the 14-character example ids (findings.md F3) wrap the hero's prompt panel one
line longer (`hero-copy`); the board's runtime drops whitespace-only text nodes,
so its skill snippet loses the blank line before "# Pull the schema again"
(`usage-tabs`); the preview shows three view tabs (owner ruling D2,
`preview-body`); the blocks table has no "Agent work" row until those block
types exist (`blocks-rows`).

## Print

`tests/print.visual.spec.ts` opens `fixtures/print-sample.payload.json` (B-Print's
title, sections and decisions D1 to D4) with `fixtures/print-state.seed.json` (a
highlight with a note, an Other answer, an open question) at 650 px, B-Print's
text width, emulates print media and fires `beforeprint`, which a real print
and `page.pdf()` fire themselves. It compares the `crop-print-*` crops, checks the
print rules with computed styles, and saves `print.pdf` from `page.pdf()` in the
test's output folder. The printed line's host is the test server's, so that line
is checked as text, not as pixels.

## Geometry

`lib/geometry.ts` has `expectBox` (bounding box within 1 px) and `expectComputed`
(exact computed CSS). The numbers in `tests/geometry.visual.spec.ts` were read from
the boards with `getBoundingClientRect` / `getComputedStyle`. Note which box a
number belongs to: the top bar is 52 high inside a 55 px `header` (2 px progress
line, 1 px border), the outline rows are 236 wide inside a 250 px panel, the dock
is 340 wide inside a 342 px box.

## Decision dock

`tests/dock.visual.spec.ts` checks the dock, the B-Mobile sheet and the
B-Overlays prompt review sheet. Board numbers were read relative to the dock (or
sheet) box, with the board fonts fetched the way the renderer fetches them; a
board measured with Google's default font files has different text widths. The
spec pins `navigator.platform` to a Mac so the app draws the boards' ⌘ key
chips. Every B-Reader decision has a context-chip row that waits on
`decision.refs`, so positions below it are the board's minus 34 per row
(`CHIPS`). The phone sheet opens with B-Mobile's own answers (D1 binding, D3 api),
not the shared seed. Its pixel crops (`crop-reader-<theme>-dock-*`) cover the
header, two option rows, a checkbox and the Copy button.

## Foundations

`tests/foundations.visual.spec.ts` checks B-Foundations without a screenshot. It
reads `tokens.css` from `BRIEF_HANDOFF_DIR` and asserts, per theme, that every
color, shadow and duration the running app resolves equals it, that the 13 D8
board colors exist in both themes, that `globals.css` `@theme` is the
`tokens.css` block, and that Geist, Geist Mono and Noto Sans Thai load. It also
measures diagram label widths in the real fonts and fails when the constants in
`apps/web/src/features/reader/lib/svgText.ts` would clip a Thai label of the
fixture or carry more than rounding slack; the measured numbers print in the
test output.

## Fixture and gaps

`fixtures/brief-sample.payload.json` reproduces the sample brief of B-Reader with
fields the current payload schema accepts (validated in
`packages/schema/test/console-sample.test.ts`). `fixtures/brief-sample.gaps.json`
lists what the board shows that the schema cannot express yet.
