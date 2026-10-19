# Block reference

Every field below is transcribed from `payloadSchema` in `packages/schema/src/payload.ts` of the ENEmyr/brief repository. If a field is not listed here, the API rejects it only when it breaks a listed rule; unknown extra keys are stripped, not honoured, so do not invent fields.

## Shared constraints

These two string rules are referenced throughout the tables.

- `label`: a string of 1 to 300 characters. Used for titles, ids, captions, axis names, and any short piece of text.
- `text`: a string of at least 1 character, with no upper bound. Used for prose.
- `short`: a string of 1 to 40 characters. Used for the histogram threshold.
- `position`: an integer of 1 or more. Line numbers, table rows and columns, and histogram bins all count from 1.

Two colour vocabularies exist, and they do not mix:

- `tone`: one of `info`, `good`, `warn`, `bad`. It is the meaning of a colour, and table cells, states, and transitions take it.
- stat tone: one of `mauve`, `blue`, `green`, `red`, `peach`, `teal`, `yellow`. It is a palette colour, and only stat tiles take it.

`"tone": "red"` on a table cell fails validation, and so does `"tone": "bad"` on a stat tile.

Two more rules that catch agents out:

- A section requires `id`, `no`, `title`, and at least one block. `no` is an integer of 1 or more and is what the reader sees as the section number.
- Every block is discriminated on `type`. A misspelled `type` fails validation with `sections.N.blocks.M: Invalid discriminator value`.

## Where each block is documented

Read only the files of the blocks you use. Each file has the field table, the exact enum values and a valid JSON example.

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
