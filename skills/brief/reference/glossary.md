# Glossary

The glossary is not a block either. It is an optional top-level `glossary` array beside `meta`, `sections`, and `decisions`. Each entry explains one term the reader may not know.

| Field | Required | Type |
| --- | --- | --- |
| `term` | yes | `label`, the term as it appears in the text |
| `def` | yes | string of 1 to 400 characters, the definition in plain words |
| `aliases` | no | array of `label`, at most 5, other spellings of the same term |

The array holds at most 60 entries. Leave it out, or send `[]`, when the document has no terms to explain.

How the reader finds a term:

- The match ignores case and takes whole words only. In scripts written without spaces, such as Thai, a term matches inside a longer run of text.
- The reader underlines the first use of each term in each section. Hover, focus, or a tap shows `def`.
- The reader looks for terms only in paragraphs (`p`) and in the title and text of `note`, `warn`, and `good` blocks, including those inside a `details` block. A term inside a table, a list, a stat tile, a diagram, or a code block is not underlined.
- A term in a decision question, an option, or a `why` is not underlined. The term's definition lists that decision as a place that uses the term.
- Each alias matches the same as the term. Use aliases for a plural, an abbreviation, or a second language, such as `["RPS", "requests per second"]`.
- A term inside an inline code run, such as `` `KV` `` in a paragraph, is not underlined.
- When two entries share a spelling, such as a term that is also another entry's alias, the earlier entry in the array wins and the later one never matches that spelling. Keep every term and alias unique.

Write `def` as one or two sentences that stand alone, and do not explain a word the reader already knows. Never put a secret, a credential, or personal data in a term, an alias, or a definition. Every reader of the document sees them.

```json
{
  "term": "Rate limit",
  "def": "The most requests one client can send in a time window. The API rejects the rest with a 429 error.",
  "aliases": ["rate limiting"]
}
```
