# Block reference

Every field below transcribed from `payloadSchema` in `packages/schema/src/payload.ts` of ENEmyr/brief repo. Field not listed here: API rejects only when it breaks listed rule; unknown extra keys stripped, not honoured. Do not invent fields.

## Shared constraints

String rules referenced throughout tables:

- `label`: string, 1-300 chars. Titles, ids, captions, axis names, any short text.
- `text`: string, >=1 char, no upper bound. Prose.
- `short`: string, 1-40 chars. Histogram threshold.
- `position`: integer >=1. Line numbers, table rows/columns, histogram bins all count from 1.

Two colour vocabularies, no mixing:

- `tone`: one of `info`, `good`, `warn`, `bad`. Meaning of colour; table cells, states, transitions take it.
- stat tone: one of `mauve`, `blue`, `green`, `red`, `peach`, `teal`, `yellow`. Palette colour; only stat tiles take it.

`"tone": "red"` on table cell fails validation, same for `"tone": "bad"` on stat tile.

Two more rules that catch agents out:

- Section requires `id`, `no`, `title`, >=1 block. `no` = integer >=1, shown to reader as section number.
- Every block discriminated on `type`. Misspelled `type` fails validation at `sections.N.blocks.M`; `validate.mjs` names the accepted types.

## Where each block is documented

Read only files of blocks you use. Each file has field table, exact enum values, valid JSON example.

| Group | Block | File |
| --- | --- | --- |
| Text and callouts | `p` | [`blocks/p.md`](blocks/p.md) |
| Text and callouts | `note`, `warn`, `good` | [`blocks/callouts.md`](blocks/callouts.md) |
| Text and callouts | `list` | [`blocks/list.md`](blocks/list.md) |
| Text and callouts | `image` | [`blocks/image.md`](blocks/image.md) |
| Data | `table` | [`blocks/table.md`](blocks/table.md) |
| Data | `compare` | [`blocks/compare.md`](blocks/compare.md) |
| Data | `stat` | [`blocks/stat.md`](blocks/stat.md) |
| Data | `coverage` | [`blocks/coverage.md`](blocks/coverage.md) |
| Data | `details` | [`blocks/details.md`](blocks/details.md) |
| Diagrams | `seq` | [`blocks/seq.md`](blocks/seq.md) |
| Diagrams | `state` | [`blocks/state.md`](blocks/state.md) |
| Diagrams | `layers` | [`blocks/layers.md`](blocks/layers.md) |
| Diagrams | `erd` | [`blocks/erd.md`](blocks/erd.md) |
| Diagrams | `mermaid` | [`blocks/mermaid.md`](blocks/mermaid.md) |
| Code and math | `ba` | [`blocks/ba.md`](blocks/ba.md) |
| Code and math | `code` | [`blocks/code.md`](blocks/code.md) |
| Code and math | `math` | [`blocks/math.md`](blocks/math.md) |
| Charts | `bigo` | [`blocks/bigo.md`](blocks/bigo.md) |
| Charts | `heatmap` | [`blocks/heatmap.md`](blocks/heatmap.md) |
| Charts | `histogram` | [`blocks/histogram.md`](blocks/histogram.md) |
| Charts | `scatter` | [`blocks/scatter.md`](blocks/scatter.md) |
| Charts | `plot3d` | [`blocks/plot3d.md`](blocks/plot3d.md) |
| Agent work | `walkthrough` | [`blocks/walkthrough.md`](blocks/walkthrough.md) |
| Agent work | `diff` | [`blocks/diff.md`](blocks/diff.md) |
| Agent work | `trajectory` | [`blocks/trajectory.md`](blocks/trajectory.md) |
| Decisions | `decisions` (top-level array, not a block) | [`reference/decisions.md`](reference/decisions.md) |
| Glossary | `glossary` (top-level array, not a block) | [`reference/glossary.md`](reference/glossary.md) |
