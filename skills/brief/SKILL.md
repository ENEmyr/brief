---
name: brief
description: Use when research, analysis, review, or planning work produces findings too large or too visual for chat, such as an architecture walkthrough, an incident review, a migration plan, or a comparison of options. Publishes the work as an interactive document on Brief (https://brief.algoryth.me) that the human reads, annotates, questions, and answers any open decisions in, then replies back into the conversation.
---
# Publish a document to Brief

## Overview

Brief turns agent work into web doc human can act on. POST one JSON payload; API returns URL; human opens it, reads sections, highlights passages to ask about or change, answers decision cards, pastes generated reply back into this conversation. You act on reply.

Payload has three required top-level keys, `meta`, `sections`, `decisions`, and one optional, `glossary`. Everything reader sees built from those.

## When to use

Use when work produced more than chat carries well: evidence reader should see laid out, flow or structure prose flattens, numbers worth chart, or choice needing evidence in front of reader. Doc need not have decision to be worth publishing. Reader can question or request edit on any passage, so explanation or review still gets reply back.

Not for answer fitting in few chat paragraphs, or dump for raw logs and command output.

## Who reads it

Reader asked for doc because they did not follow work. They know their product and what they asked. They do not know files you opened, commands you ran, names you coined, ticket and task numbers you tracked, or what earlier doc said. Write every sentence so that person follows without asking. If they would ask "what is that?", sentence not finished.

Doc fails reader two ways: buries point under story of how you worked, or reads smoothly but omits facts reader came for. "What the reader needs" and "Writing for the reader" below guard each.

## Workflow

1. **Research and verify.** Read real files, trace real code paths, run real commands. Every number and claim in payload must come from something you saw. Note source of each fact; note goes in a `details` block, not in your sentences. A claim that later work "will add" or "will provide" something is a plan, not a fact: label it planned and name the check that will confirm it.
2. **List what the reader needs.** Find kind of work in "What the reader needs" below, write down each fact its row asks for. Fact you could not get = gap to state in doc, not row to drop.
3. **Plan the sections.** Section 1 = summary of two to four sentences: what you found or did, what it means for reader, what they should do now, no name reader has not met. Do not restate request. Then one topic per section, reading order, numbered from 1.
4. **Pick a block for each fact.** Use "Choosing blocks" below to match each fact to block built for its shape, then read `BLOCKS.md` in this skill directory: holds rules all blocks share, says which file in `blocks/` documents each of 27 block types. Read only files of blocks you use; each has exact fields, enum values, valid JSON example.
5. **Write for the reader.** Follow "Writing for the reader" below.
6. **Add decisions only for calls the human must make.** Settle every question you can answer by thinking or checking, say in doc what you chose. Decision = choice turning on human's priorities, money, risk, or taste, with at least two options you would accept. Write those last, so options reflect research, each with honest `detail` text and usually `why` stating your recommendation and its cost. Add `refs` with ids of sections setting decision up, so reader can jump back to evidence. Nothing left to decide -> send `"decisions": []`; reader then shows no decision area.
7. **Reread it as the reader.** Before validating, read payload as someone who saw none of this session. Every name, path, id, abbreviation, number explained where it first appears, or cut. Every fact from step 2 present. No sentence describes how you worked.
8. **Validate before publishing.** Write payload to file, run `node <skill-dir>/validate.mjs payload.json`. If doc has `image` block, validate and verify it with a placeholder `imageId` (any `[\w-]{8,64}`, such as `img_PLACEHOLDER1`); upload each image per `reference/images.md` only after the last check passes, put the returned `imageId` in the block, and publish at once, because an upload that no brief names within an hour is lost. Offline, no install, rejects exactly what API rejects. Also prints readability hints. Do not skip; failed POST costs request against ten-per-minute limit and returns at most ten problems.
9. **Publish and hand over the URL.** Give human link, nothing else; doc carries content now.
10. **Act on the reply.** Human pastes generated prompt back into conversation. Read `reference/replies.md`.

Skill directory holds: `BLOCKS.md` (shared block rules + index), `blocks/` (one file per block), `reference/` (decisions, glossary, image upload, replies, writing in Thai, read when needed), `example.payload.json` (complete valid doc to model on), `validate.mjs` (pre-flight check).

## What the reader needs

Doc can read well and still fail because number reader came for is missing. Before writing, find row for kind of work, collect each fact listed.

| Kind of work | Facts the reader needs | Blocks that carry them |
| --- | --- | --- |
| Performance, load, or capacity | Target, and machine or plan it runs on with size and price. Result vs target, before and after, measured same way. How each number measured: tool, load, data size, runs, spread. Where time or resources go. Each fix, shown as code. How cost grows with users or data. Money cost now and at target. What was not measured. | `stat`, `table`, `histogram`, `scatter`, `bigo`, `ba`, `coverage` |
| Bug, incident, or failed test | What user saw. Cause, as chain of steps. Fix. Proof it works. What can still go wrong. | `seq`, `state`, or a `mermaid` flowchart, then `ba`, `good`, `warn` |
| Code review | What change is for, in user's terms. Verdict. Findings by severity, each with effect on users. Code behind each blocking finding, and its fix. What tests cover, which checks fail. | `table`, `code` or `ba`, `coverage` |
| A change you made | What changed for user. How it works now. What changed where. How you checked. What is left. | `mermaid` or `layers`, `table`, `ba`, `coverage` |
| How something works | What each part is. How request or record moves through parts. Its states. Its data. | `mermaid` flowchart, `seq`, `state`, `erd` |
| Deployment, migration, or rollout | Target layout. Steps in order, with who does each. Risks. How to roll back. Cost. | `mermaid`, `table`, `warn` |
| Database design | Tables and how they relate. Example rows. Queries it must serve. | `erd`, `table`, `code` |
| Choosing between options | What each option is. Same criteria applied to every option. Cost and effort. Your recommendation and its downside. | `table` with one row per criterion, `compare` for two options, a decision |

Three rules for every kind of work. Claim about code shows the few lines in `code` or `ba` block instead of naming file and line; code shown as today is copied from source, proposed code says whether you ran it. Equation comes with variables explained and one worked example. Number comes with what it is measured against: target, previous value, or limit.

## Writing for the reader

- **Lead with the point.** First sentence of each section = its conclusion. Evidence and method follow; long evidence goes in `details` block.
- **One topic per paragraph.** Six sentences max, usually two or three, topic in first sentence. Paragraph counting "first ..., second ..., third ..." is a `list`, or `table` with one row per item when each item has more than one attribute. Validator hints at any paragraph over 400 characters.
- **Explain or cut every name the reader has not met.** Covers file paths, function and variable names, ticket and PR numbers, decision ids, labels you made up while working (lanes, phases, cards). Say what thing is or does in plain words: "the function that saves the host settings", not `config.SaveHost`. When reader needs exact path to act or check, put it in table column, code block's `filename`, or `details` block. Domain term reader needs but may not know goes in `glossary`, so definition shows where term appears.
- **Make the document stand alone.** If it follows earlier doc or conversation, restate in one sentence what that one found or decided. Never point to "the card" or "last round".
- **Leave out how you worked.** Subagents, lanes, verifiers, worktrees, commands you ran, folders your notes live in mean nothing to reader. Give result. If method changes how far to trust it, say so in one sentence or put in `details` block.
- **Say how facts relate.** Reader takes two facts side by side as cause and effect. If unrelated, say so, or keep apart.
- **Mark uncertainty once.** Say which numbers are estimates in one place, such as stat hint or `coverage` block of what was not checked. Parenthesis in every clause buries result.
- **Write in the language the human uses most with you, the way you would say it to a colleague.** If they mostly write Thai, write doc in Thai from first draft, even when code, notes, and own reasoning are English. Translated English draft keeps English grammar, reads as translation. If writing Thai, read `reference/thai.md` first.
- **Only paragraphs, callouts and list items render inline markdown.** In a `p`, in the title and text of a `note`, `warn`, or `good`, and in each item of a `list`, the reader renders `` `inline code` ``, `**bold**`, and `*italic*`. Nothing nests, and links are not rendered. Every other field, such as a table cell, a list caption, a decision, or a label, shows exactly as typed, so backticks and asterisks there appear as literal characters. Put longer code in a `code` block.
- **No emoji, no em dash, no en dash.** Use a plain hyphen.
- **Honest `detail` on every option.** An option with no downside listed reads as a sales pitch, and it costs the reader their trust in the rest of the document.

The same finding, written twice:

| Written for someone who was in the session | Written for the reader |
| --- | --- |
| Per the chmod-test card I mounted the export at /tmp/pxx-nfs-test-docs and ran the probe as uid 102000. chmod returned EPERM, so mp0 cannot point at documents without a Hand Step. | The notes app cannot save into the documents share as it is set up today. The NAS refuses permission changes there, and the app changes a file's permissions every time it saves. So the second save of any note fails. Each fix needs you to change a setting on the NAS. |

### Sentences and words (ASD-STE100)

Write every text field by the writing rules of ASD-STE100, Simplified Technical English (Issue 9, 2025), in the language of the document. The rules below are the ones that change a brief. The approved dictionary and the rules for English verb forms apply only to a document in English; they have no Thai equivalent.

- **Keep sentences short.** An instruction has 20 words at most, and a description has 25. In Thai, count words as you would in English, and when และ, แต่, ซึ่ง, or เพราะ starts a second idea, make two sentences. The validator counts English sentences only.
- **Write one instruction per sentence, as a command, with the condition first.** "If the build fails, run the tests again." In Thai, "ถ้า build ไม่ผ่าน ให้รันเทสต์อีกครั้ง".
- **Start a warning with a command or a condition.** Then give the risk.
- **Use the active voice and name who does the action.** Use the passive only when the actor is unknown. In Thai, do not copy the English passive with ถูก.
- **Use one word for one meaning.** Give each thing one name, the name the product uses, and keep it to the end.
- **Use three nouns in a row at most.** Break a longer chain with of, for, or a verb in English, and with ของ, ที่, or สำหรับ in Thai.
- **Do not drop words to make a sentence shorter.** Keep the verbs, the articles, and Thai words such as ที่, ว่า, and ให้. A fragment or a chain of colons makes the reader rebuild the sentence.
- **Put a list in a block, not in a sentence.** Use a `list` when each item is one phrase or one step. Use a `table` with one row per item when the items have several attributes.

| Before | After ASD-STE100 |
| --- | --- |
| แถวที่หมดอายุจะถูกลบโดยงานที่รันทุกวัน ซึ่งถ้ามีคนเปิดก่อนก็จะถูกลบตอนนั้นแทน | งานล้างข้อมูลลบแถวที่หมดอายุทุกวัน ถ้ามีคนเปิดเอกสารที่หมดอายุก่อน API จะลบแถวนั้นทันที |
| ควรจะมีการเปิด nesting ก่อนที่จะ deploy ถ้าใช้ Debian 13 | ถ้าเครื่องใช้ Debian 13 ให้เปิด nesting ก่อน deploy |
| ระบบตรวจสอบสิทธิ์การเข้าถึงข้อมูลผู้ใช้ระดับโรงเรียน | ระบบที่ตรวจว่าผู้ใช้เปิดข้อมูลของโรงเรียนได้หรือไม่ |
| ข้อเสีย: ลึกขึ้นหนึ่งชั้น | ข้อเสียคือโฟลเดอร์จะลึกขึ้นหนึ่งชั้น |
| Log what would have been blocked, block nothing. | Log each request that the limit would stop. Do not stop any request. |

## The envelope

The request body wraps the payload in a `payload` key. Nothing else in the body is read.

```text
{ "payload": { "meta": <meta object>, "sections": [<section>, ...], "decisions": [<decision>, ...], "glossary": [<entry>, ...] } }
```

The smallest document the API accepts:

```json
{
  "payload": {
    "meta": { "title": "Add rate limiting to /api/session" },
    "sections": [
      {
        "id": "overview",
        "no": 1,
        "title": "Overview",
        "blocks": [{ "type": "p", "text": "The session endpoint accepts unbounded writes today." }]
      }
    ],
    "decisions": []
  }
}
```

### `meta`

`title` is the only required field. All of `author`, `role`, `date`, `version`, `repo`, `readTime`, `docId`, and `subtitle` are optional strings; each is capped at 300 characters except `date` and `repo`, which are free strings.

### `sections`

At least one. Each needs `id` (short, unique, used as the URL fragment), `no` (integer of 1 or more, the number the reader sees), `title`, and `blocks` (at least one).

### `decisions`

May be empty, and then the reader shows no decision area. Each decision needs `id`, `q`, `multi`, and at least two `opts`. Each option needs an `id` and a `label`, and takes an optional `detail`. Set `multi` to `false` for an either-or choice and `true` when several options can be taken together. The optional `refs` field lists the ids of the sections that set the decision up. The full field reference, including the two fields agents habitually get wrong (`cmp` and `dia`), is in `reference/decisions.md`.

### `glossary`

Optional. An array of at most 60 entries, each with a `term`, a `def` of at most 400 characters, and up to five `aliases`. The reader underlines the first use of each term in each section and shows the definition on hover or tap. It looks for terms only in paragraphs and in `note`, `warn`, and `good` callouts. Leave the key out when there is nothing to define. The fields and the matching rules are in `reference/glossary.md`.

## Choosing blocks

Pick a block when the reader gets the point from it faster than from a sentence. Several blocks also respond to the reader, which prose cannot: `seq` steps through its messages one at a time, `walkthrough` steps through code and its flowchart together, `diff` switches between the agent's notes and the raw patch, `trajectory` filters the agent's run by kind and lets the reader mark flagged steps, `details` folds away, and every diagram and chart opens in a pan-and-zoom view. `state`, `layers`, and `erd` are static diagrams.

Take each fact from your list and find the block built for its shape in the table below. An argument with no other shape stays in paragraphs. Prose is the glue between blocks: a sentence that says what a block shows and why it matters.

A block is forced when it holds less than a sentence would, or when the reader needs a paragraph to learn how to read it. The usual cases are a table of one row, a diagram of two boxes, a stat tile whose label or hint is a sentence, a `compare` whose two sides answer different points, a `coverage` list of the commands you ran, a table whose cells are paragraphs, and a growth chart whose curves all have the same shape. Write those as a sentence or two. A block is missing when the reader has to build the picture in their head: a flow told in prose, a set of numbers inside a paragraph, a database design with no `erd`, or options that grow at different rates compared only in prose.

| You have | Use | Not |
| --- | --- | --- |
| An argument or explanation in prose | `p` | A `note` for every paragraph. Callouts lose their weight when everything is one. |
| A caveat the reader must not miss | `warn` | A `p` starting with "Warning:". |
| An aside the reader can skip | `note` | `warn`, which signals risk. |
| A result worth celebrating, or a passing check | `good` | `stat`, which is for numbers. |
| Enumerable facts with the same shape, such as findings with a severity, steps with an owner each, or options across several criteria | `table`, each cell a phrase, with a caption that says what the table shows | A paragraph that counts "first ..., second ...", or cells that are whole paragraphs. |
| Items with one attribute each, such as steps to follow, prerequisites, or files to change | `list`, with `ordered` set to `true` when the order matters | A `table` with one column, or a paragraph that counts "first ..., second ...". When each item has two or more attributes, use a `table`. |
| Two options compared point by point, where each item on one side answers the same point on the other | `compare` | Two unrelated lists of pros and cons. Use a `table` with one row per criterion. |
| Two or three headline numbers the reader came for | `stat`, with a label and a hint of a few words each | A one-row `table`, or counts of your own process such as findings checked. |
| What is covered, partly covered, and missing, such as requirements or test cases | `coverage` | A `table` with a "Status" column, or a list of the commands you ran. |
| Long evidence or method that supports a claim but interrupts reading | `details` | Cutting the evidence. Content the reader needs to follow the argument, such as the options being decided, stays outside it. |
| A message exchange over time between named parties | `seq` | `mermaid` with a `sequenceDiagram`, which is not interactive. |
| A machine with states and transitions | `state` | `mermaid` with a `stateDiagram`. |
| A system in named tiers, such as client, edge, and storage, with the flow between them | `layers`, one layer per tier; every layer shows at once | A flow with no tiers. Use `mermaid` with a `flowchart`, or `walkthrough` when the flow is code. |
| A code change, old versus new | `ba` | Two `code` blocks. |
| How cost grows as input or load rises, when the options or parts grow at different rates | `bigo` | A chart whose curves all have the same shape, which one sentence says better, or `scatter` with hand-computed points. |
| How one function or handler works, line by line, beside a flowchart of what it does | `walkthrough` | A `code` block followed by a `mermaid` flowchart, which the reader must match up by hand. |
| A change set across files, with what each change does | `diff`, a note per changed symbol and the patch for the raw view | A `ba` per file, or a `table` of file names. Use `ba` for one snippet before and after. |
| How the agent reached a result, when the path changes how far to trust it | `trajectory`, with the assumptions the result rests on flagged | A log of every command, or a paragraph that tells the story of the session. |
| A screenshot, a photo, or a chart from another tool | `image`, after you upload the file | A URL or a file path in `imageId`, or a chart you could build with `histogram`, `scatter`, or `stat`. |
| A snippet the reader should read as code, including the lines behind a claim about code | `code` | A file name and line number in a sentence, or a `p` with backticks. |
| A diagram no other block covers (a flowchart of components, Gantt, class, mindmap, ER variants) | `mermaid` | Forcing the data into `layers` or `seq`. |
| An equation, with its variables explained and a worked example beside it | `math` | A `code` block with LaTeX in it. |
| Tables, columns, keys, and their relationships, including any database design | `erd` | `mermaid` with `erDiagram`, unless you need an ER feature this block lacks. |
| A value per cell across two labelled axes | `heatmap` | `table` full of numbers. |
| A count or a share per category, such as where the time goes | `histogram` | `table` of counts. |
| Points in two dimensions, such as latency against load or the measurements behind a fitted equation | `scatter` | `histogram`, or an equation with no points behind it. |
| Points or a surface in three dimensions | `plot3d` | Two `scatter` blocks. |

## Validating the payload

Write the payload to a file and run the validator that ships with this skill. Do this before every POST; it costs nothing and it is the difference between one request and a guess-and-retry loop against a rate limit of ten per minute.

```sh
node <skill-dir>/validate.mjs payload.json
```

It takes either the bare payload or the `{"payload": ...}` envelope, and it needs no install: no npm, no network, no dependencies. Node 18 or later, or Bun, is enough.

A clean payload:

```text
Valid. 4582 bytes, 3 section(s), 2 decision(s), 0 readability hint(s).
```

A broken one, one line per problem, exiting non-zero:

```text
warning  sections.0.blocks.1.items.0.color: Unknown field. The API strips it; it will never render.
sections.1.blocks.0.head: Invalid input: expected array, received undefined
decisions.0.opts: Too small: expected array to have >=2 items

2 problem(s). The API would reject this payload with a 400.
```

Read a path literally: `sections.1.blocks.0.head` is the `head` field of the first block of the second section. Fix exactly the paths named, then re-run until it passes.

Warnings are different from errors. A warning means the API will accept the payload but the field you wrote does nothing, because the schema strips keys it does not know. `sections.0.blocks.1.items.0.color` is a real example: the field is called `tone`, so a block with `color` publishes and renders with no colour at all. Treat a warning as a silently broken block, not as a nit.

Hints are the third kind of line, and they never change the exit code. Each one names a pattern that makes the document hard to read for someone who did not follow the work: a paragraph over 400 characters, an English sentence over 25 words, a table cell over 200 characters, a stat label or hint over 50, a file path in running text, or markdown that the field does not render: a link anywhere, or backticks and `**` outside a paragraph, a callout, or a list item.

```text
hint     sections.1.blocks.0.text: 512 characters in one paragraph. Keep one point per paragraph: split it, or move the supporting detail into a table or a details block.
hint     sections.2.blocks.1.text: File path in running text (apps/api/src/index.ts). Say what the file does instead; if the reader needs the path, put it in a table, a code block's filename, or a details block.
```

Fix each hint unless you can name the reason this document needs the exception, such as a setup guide where the path is the instruction.

The validator reads `payload.schema.json`, which is generated from the same Zod schema the API validates with, and a test in the ENEmyr/brief repository fails if the two ever drift. So a payload this script accepts is a payload the API accepts.

If the script cannot run in your environment, the API is still the backstop: it rejects an invalid payload with a 400 whose `error` string names each failing path in the same `path: message` form.

```json
{ "error": "sections.0.blocks.2.head: Invalid input: expected array, received string; decisions.0.opts: Too small: expected array to have >=2 items" }
```

At most ten issues are reported per 400, so a long list may be truncated. That truncation is the reason to validate locally first.

## Publishing

```bash
curl -sS -X POST https://brief-api.algoryth.me/api/session \
  -H 'content-type: application/json' \
  -d @payload.json
```

Write the payload to a file and POST it with `-d @file`. Inlining a large JSON document as a shell argument invites quoting bugs that look like schema errors.

### Responses

| Status | Body | What to do |
| --- | --- | --- |
| 201 | `{ "id": "aB3xYz01qWe9rT", "url": "https://brief.algoryth.me/s/aB3xYz01qWe9rT" }` | Give the `url` to the human. Keep the `id`. |
| 400 | `{ "error": "path: message; path: message" }` | Fix the named paths and re-POST. |
| 413 | `{ "error": "Payload exceeds 1900000 bytes." }` | Cut content. Long code and raw command output are the usual cause; move them into a `details` block or drop them. |
| 429 | `{ "error": "Rate limit exceeded. Try again in a minute." }` | Ten creations per minute per IP. Wait; do not retry in a loop. |

If the document has an `image` block, read `reference/images.md` first: it says how to upload each file and get its `imageId`.

### Reading a document back

`GET https://brief-api.algoryth.me/api/session/<id>/raw` returns the document as markdown. It contains only the payload you sent, never the reader's annotations or answers. It returns 404 `{ "error": "Session not found or expired." }` for a wrong or expired id, and 403 `{ "error": "This session is protected..." }` once the reader password-protects the session; the content is then not readable by you. Keep your own copy of any payload you may need later rather than relying on this endpoint.

## What comes back

The reader replies by pasting a generated prompt into this conversation: decision answers, a question about a highlighted passage, or a request to update the document. When one arrives, read `reference/replies.md`, which shows each shape and how to act on it. Do not ask the human to restate them.

When the document has decisions, design them so this loop closes in one pass. A question the human cannot settle from the document alone is a question that comes back as another round trip.

## Common mistakes

| Mistake | Reality |
| --- | --- |
| A file path, function name, or line number in a sentence | The reader does not know it. Say what the thing does. Put the path in a table column, a code block's `filename`, or a `details` block, and show the code itself when the claim is about code. |
| An id the reader has never seen: a ticket, a card, a lane, an earlier document | Explain it in words or cut it. Each document stands alone. |
| Telling the story of how you worked | The reader wants the result. Give the method one sentence, or a `details` block when it affects how far to trust the result. |
| A performance or capacity document with no setup, no before and after, no complexity, or no money cost | See "What the reader needs". Those are the facts the reader came for. |
| Handing the human a question you could settle | Decide it, say what you chose, and keep decisions for calls that turn on their priorities, money, risk, or taste. A status or a question that the human's standing rules already settle, such as reporting work as "partial" for a reason they ruled out, is unfinished work, not a finding. Have the verifier check the document's framing against those rules, not only its facts. |
| Writing in English and translating into Thai | The translation keeps English grammar, full stops, and calques. Write in Thai from the first draft. |
| A sentence that carries two ideas, or a passive copied from English | Split it, and name who does the action. ASD-STE100 keeps a description to 25 words and an instruction to 20. |
| Backticks or `**` in a table cell, a label, or a decision | Only a `p`, the title and text of a `note`, `warn`, or `good`, and the items of a `list` render inline code, bold, and italic. Everywhere else they show as literal characters. Links render nowhere. |
| A URL, a file path, or a data URI in an image's `imageId` | `imageId` takes only the id that `POST /api/image` returned. Upload the file first. |
| Uploading an image and creating the brief more than an hour later | After one hour an upload that no brief names can no longer be linked and is never served, and the daily purge deletes it. The block shows a missing image. Upload, then create the brief right away. |
| A trajectory `at` with an offset, such as `+07:00`, or with no time | `at` is UTC and ends in `Z`: `"2026-07-12T09:05:40Z"`. Convert local times first. |
| A table cell or stat tile that holds a paragraph | Keep cells and tiles to a phrase. The explanation goes in a paragraph beside the block. |
| Putting Mermaid source in a decision's `dia` | `dia` is a plain string label, rendered literally as `[diagram: <your string>]`. For a real diagram, put a `seq`, `state`, `layers`, or `mermaid` block in the section that sets the decision up. |
| Including `"type": "table"` inside a decision's `cmp` | `cmp` is a table shape with the `type` key removed: `{ head, rows, caption? }`. |
| Numbers in `table.rows` cells | Cells are strings. Write `"48120"`, not `48120`. |
| Nesting a `details` inside a `details` | Rejected by the schema. Flatten it. |
| Counting note lines from 0, or past the end of the code | `code` and `ba` notes count lines from 1, and `to` must not be before `from`. A note outside the listing, or outside its `side` of a `ba`, is dropped without an error. Count the lines of the code you wrote. |
| A decision id, a section number, or a title in a decision's `refs` | `refs` holds section `id` values, such as `"evidence"`. An id that matches no section is dropped without an error. |
| Expecting a glossary term to be underlined in a table, a list, a stat tile, or code | The reader looks for terms only in paragraphs and in `note`, `warn`, and `good` callouts. Use the term in a sentence of one of those blocks. |
| A secret, a credential, or personal data in a code note or a glossary entry | Never put them there. Every reader of the document sees notes and definitions. |
| `"tone": "red"` on a table cell, state, transition, or walkthrough node or edge, or `"tone": "bad"` on a stat tile | Table cells, states, transitions, and walkthrough nodes and edges take `info`, `good`, `warn`, or `bad`. Stat tiles take the colour names `mauve`, `blue`, `green`, `red`, `peach`, `teal`, or `yellow`. |
| Counting the header row in a table's `cells`, or counting `cells` and a histogram `threshold.bin` from 0 | `row: 1` is the first array in `rows`. Rows, columns, and bins count from 1. A position outside the table or past the last bin is ignored without an error. |
| A one-column `table` for a list of steps | Use a `list` block with `ordered: true`. |
| Explaining a flow, a comparison, or a set of numbers in paragraphs | Use the block built for that shape, and keep the paragraph for what the block cannot say, such as why it matters. |
| A block that repeats the paragraph beside it | Keep whichever carries the fact better and cut the other. |
| Adding a decision so the document has one | `"decisions": []` is a complete document. A decision is for a choice the human owns, with at least two options you would accept. |
| Publishing unverified claims | Every number and path must come from the research phase. A confident wrong document is worse than no document. |
| Retrying a 429 in a loop | Ten creations per minute. Fix the payload offline, then POST once. |
| POSTing without running `validate.mjs` | The script is offline and free; a rejected POST is not. Validate, then publish. |
| Ignoring a warning from `validate.mjs` | A warning is a field the API strips and the reader never sees, such as `color` where the schema says `tone`. The block publishes silently broken. |
