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

Use Node 22 (`mise exec node@22.23.2 -- ...`). The renderer needs network on
first use for Google Fonts and refuses to write references if a font is missing.

## How it works

- `render-references.ts` reads the boards from `BRIEF_HANDOFF_DIR` (default
  `/home/enemy/Repository/interactive-docs/.design-handoff/console`), serves
  them over http, renders them in Playwright's Chromium at DPR 1 after the fonts
  loaded, and writes PNGs to `reference/` (gitignored, never committed). Board
  files are never copied into the repo. The lightified landing is generated into
  `reference/.generated/`.
- Fonts on the boards come from Google Fonts, which serves different files per
  user agent (different advance widths: a Thai line wraps at a different word).
  The renderer sends every `fonts.googleapis.com` and `fonts.gstatic.com`
  request with the user agent next/font/google downloads with, read at run time
  from the installed Next (`next/dist/compiled/@next/font/dist/google/fetch-resource.js`),
  so the boards get the files the app ships and a Next upgrade cannot drift
  silently. If that file stops carrying the header, the renderer throws.
  Once the app ships Geist (Phase 1), the stronger option is to serve the app
  build's own woff2 files (`apps/web/.next/static/media/`) to the boards, which
  also removes drift between a build and a later reference render.
- Both sides refuse fallback fonts (`lib/fonts.ts`): the renderer needs Geist,
  Geist Mono, and Noto Sans Thai wherever Thai text is set in a stack that names
  it (`BOARD_FONTS`); the app side needs its next/font families (`APP_FONTS`,
  the same set since Phase 1).
  A missing family fails the run as a harness error, not as a pixel diff.
- `visual.config.ts` serves `apps/web/out` with `wrangler pages dev` on 8789.
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
- Renders of the references are not always byte-identical. Most differences are
  anti-aliased pixels below the comparator's threshold (under 90 per image,
  channel delta at most 2), for example at the lime 1 px rounded corners in the
  dock or inside section 02. One is larger: on about 1 render in 8,
  `board-B-Blocks2.png` rasterizes its h1 differently, and 38 pixels differ
  from the other renders by Playwright's comparator (channel delta up to 223).
  That is about 195 times under the 0.002 budget for that image, and no spec
  compares `board-*.png` today, so no `toHaveScreenshot` result changes. A spec
  that starts comparing a board image should allow for it.

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
- Output is `reference/crop-<name>.png`, cut out of the full board render at the
  element's box. To compare the app with it, add a spec that cuts the matching
  app element the same way: `toHaveScreenshot('crop-<name>.png', { fullPage: true,
  clip: await clipOf(locator) })`. Assert `toBeVisible()` on the locator first, as
  the region specs do, so a missing element fails with its selector instead of a
  timeout inside `clipOf`.

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
