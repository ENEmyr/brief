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
| `mobile-{dark,light}-{reading,sheet}.png` | the two phone screens, 388x763 (see `PHONE_SCREEN` in `lib/regions.ts`) |
| `landing-{dark,light}.png`, `print.png` | B-Landing (light via `tools/lightify.py`), B-Print |
| `crop-<name>.png` | element crops listed in `crops.json` |

The B-Mobile frame is 390 wide with a 1px border and radius 36. The crop is the
388 px screen below the 44 px status-bar offset, and leaves out the bottom 35 px
(the rounded corners), which would otherwise carry about 0.17% of backdrop
pixels. So the mobile spec runs at a 388x763 viewport.

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
- Output is `reference/crop-<name>.png`. To compare the app with it, add a spec
  that calls `toHaveScreenshot('crop-<name>.png')` on the matching app element.

## Geometry

`lib/geometry.ts` has `expectBox` (bounding box within 1 px) and `expectComputed`
(exact computed CSS). The numbers in `tests/geometry.visual.spec.ts` were read from
the boards with `getBoundingClientRect` / `getComputedStyle`. Note which box a
number belongs to: the top bar is 52 high inside a 55 px `header` (2 px progress
line, 1 px border), the outline rows are 236 wide inside a 250 px panel, the dock
is 340 wide inside a 342 px box.

## Fixture and gaps

`fixtures/brief-sample.payload.json` reproduces the sample brief of B-Reader with
fields the current payload schema accepts (validated in
`packages/schema/test/console-sample.test.ts`). `fixtures/brief-sample.gaps.json`
lists what the board shows that the schema cannot express yet.
