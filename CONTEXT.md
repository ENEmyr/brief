# Ubiquitous Language — Brief

Glossary of domain terms. Definitions only, no implementation details.

## Terms

### Brief
The product: a platform where a coding agent publishes a Session for a developer to read, review, and decide on. Also used as a noun for one published document ("a brief").

### Session
One published interactive document. Created when an agent submits a Payload; identified by a Session ID. Anyone holding the Session URL can read it. A Session is immutable content (the Payload) plus mutable reader state (Annotations, Decision answers). Every Session carries a sliding expiry: opening it resets the clock; an unsaved Session lives 7 days from last open, a Saved Session lives 90 days.

### Save
A reader action that marks a Session as worth keeping, extending its sliding expiry window from 7 to 90 days. Any reader holding the URL can Save. Saving optionally sets a Password, turning the Session into a Protected Session.

### Protected Session
A Saved Session whose content is encrypted end-to-end with a reader-chosen Password. The server stores only ciphertext and can never read it. Opening requires the Password in the browser. A Protected Session has no Raw Export; losing the Password loses the content permanently. Only non-content metadata (timestamps, saved flag) remains readable; the title is blanked at protection time.

### Payload
The document content Claude produces: metadata, Sections of content Blocks, and Decisions. The Payload is authored by an agent, never edited by the reader.

### Section
A numbered top-level division of a Payload. Owns an ordered list of Blocks. The table of contents is built from Sections.

### Block
The smallest unit of content inside a Section. Each Block has a type (paragraph, callout, table, comparison, stat, coverage, details, sequence diagram, state machine, layer diagram, before/after, interactive chart). Some Block types are interactive widgets.

### Decision
A question card in the Payload that the reader must answer (single or multiple choice, plus free text). Each Decision may carry explanation, comparison table, and diagram. Answering all Decisions unlocks Prompt crafting.

### Annotation
A reader-added mark anchored to a text span in the document. Three kinds: Highlight, Note, Ask. Annotations belong to the reader's device, not to the Payload.

### Highlight
An Annotation that visually marks a text span with no attached content.

### Note
An Annotation with editable reader text attached to a span, shown with a dot marker.

### Ask
An Annotation that captures a reader question about a specific span. An Ask can be exported as a Prompt carrying full reference context (document URL, anchor, section, quoted text).

### Prompt
Crafted text intended to be pasted into Claude Code. Produced two ways: from a completed set of Decision answers, or from a single Ask. The reader reviews and may edit a Prompt before copying.

### Raw Export
The clean, machine-readable Markdown representation of a Session, served for agents so they never scrape HTML. Self-describing: every Block declares what it is.

### Reader
The person consuming a Session in the browser (developer/engineer). Also names the frontend surface that renders Sessions.

### Preference
A reader-level setting independent of any single Session (e.g. theme choice). Distinct from Annotations and Decision answers, which are per-Session.
