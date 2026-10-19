# Glossary

Glossary not block either. Optional top-level `glossary` array beside `meta`, `sections`, `decisions`. Each entry explains one term reader may not know.

| Field | Required | Type |
| --- | --- | --- |
| `term` | yes | `label`, term as appears in text |
| `def` | yes | string 1-400 chars, definition in plain words |
| `aliases` | no | array of `label`, max 5, other spellings of same term |

Array holds max 60 entries. Omit it, or send `[]`, when doc has no terms to explain.

How reader finds term:

- Match case-insensitive, whole words only. In scripts without spaces (e.g. Thai), term matches inside longer text run.
- Reader underlines first use of each term per section. Hover, focus, or tap shows `def`.
- Reader scans terms only in paragraphs (`p`) and title + text of `note`, `warn`, `good` blocks, incl. those inside `details` block. Term inside table, list, stat tile, diagram, or code block not underlined.
- Term in decision question, option, or `why` not underlined. Term's definition lists that decision as place using term.
- Each alias matches same as term. Use aliases for plural, abbreviation, or second language, e.g. `["RPS", "requests per second"]`.
- Term inside inline code run, e.g. `` `KV` `` in a paragraph, is not underlined.
- When two entries share a spelling, such as a term that is also another entry's alias, the earlier entry in the array wins and the later one never matches that spelling. Keep every term and alias unique.

Write `def` as 1-2 standalone sentences. Don't explain words reader already knows. Never put secret, credential, or personal data in term, alias, or definition. Every reader of doc sees them.

```json
{
  "term": "Rate limit",
  "def": "The most requests one client can send in a time window. The API rejects the rest with a 429 error.",
  "aliases": ["rate limiting"]
}
```
