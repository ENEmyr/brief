---
name: brief
description: Use when research, analysis, review, or planning work produces findings too large or too visual for chat, such as an architecture walkthrough, an incident review, a migration plan, or a comparison of options. Publishes the work as an interactive document on Brief (https://brief.algoryth.me) that the human reads, annotates, questions, and answers any open decisions in, then replies back into the conversation.
---

# Publish a document to Brief

## Overview

Brief turns a piece of agent work into a web document the human can act on. You POST one JSON payload; the API returns a URL; the human opens it, reads the sections, highlights passages to ask about or change, answers any decision cards, and pastes a generated reply back into this conversation. You then act on that reply.

The payload has three required top-level keys, `meta`, `sections`, and `decisions`, and one optional key, `glossary`. Everything the reader sees is built from those.

## When to use

Use it when the work produced more than chat carries well: evidence the reader should see laid out, a flow or structure that prose flattens, numbers worth a chart, or a choice that needs the evidence in front of the reader. A document does not need a decision to be worth publishing. The reader can question or ask for an edit on any passage, so an explanation or a review still gets a reply back.

Do not use it for an answer that fits in a few chat paragraphs, or as a place to dump raw logs and command output.

## Who reads it

The reader asked for this document because they did not follow the work. They know their product and what they asked you to do. They do not know the files you opened, the commands you ran, the names you gave things along the way, the ticket and task numbers you tracked, or what an earlier document said. Write every sentence so that person can follow it without asking. If they would have to ask "what is that?", the sentence is not finished.

A document fails this reader in two ways. It buries the point under the story of how you worked, or it reads smoothly and leaves out the facts the reader came for. "What the reader needs" and "Writing for the reader" below guard against each.

## Workflow

1. **Research and verify.** Read the real files, trace the real code paths, run the real commands. Every number and claim that reaches the payload must come from something you actually saw. Note where each fact came from; that note belongs in an evidence block, not in your sentences.
2. **List what the reader needs.** Find the kind of work in "What the reader needs" below and write down each fact its row asks for. A fact you could not get is a gap to state in the document, not a row to drop.
3. **Plan the sections.** Section 1 is a summary of two to four sentences: what you found or did, what it means for the reader, and what they should do now, with no name the reader has not met. Do not restate the request. After it comes one topic per section, in reading order, numbered from 1.
4. **Pick a block for each fact.** Use "Choosing blocks" below to match each fact to the block built for its shape, then read `BLOCKS.md` in this skill directory for that block's exact fields, enum values, and a valid JSON example. It covers all 27 block types.
5. **Write for the reader.** Follow "Writing for the reader" below.
6. **Add decisions only for calls the human must make.** Settle every question you can answer by thinking it through or checking, and say in the document what you chose. A decision is for a choice that turns on the human's priorities, money, risk, or taste, with at least two options you would accept. Write those last, so the options reflect what the research found, each with honest `detail` text and usually a `why` that states your recommendation and its cost. Add `refs` with the ids of the sections that set the decision up, so the reader can jump back to the evidence. When nothing is left to decide, send `"decisions": []`; the reader then shows no decision area.
7. **Reread it as the reader.** Before validating, read the payload as someone who saw none of this session. Every name, path, id, abbreviation, and number is explained where it first appears, or it goes. Every fact from step 2 is there. No sentence describes how you worked.
8. **Validate before publishing.** If the document has an `image` block, upload each image first and put the returned `imageId` in the block, as "Uploading an image" says. Write the payload to a file and run `node <skill-dir>/validate.mjs payload.json`. It is offline, needs no install, and it rejects exactly what the API rejects. It also prints readability hints. Do not skip it; a failed POST costs a request against a ten-per-minute limit and returns at most ten of the problems.
9. **Publish and hand over the URL.** Give the human the link and nothing else; the document carries the content now.
10. **Act on the reply.** The human pastes a generated prompt back into the conversation. See "What comes back" below.

This skill directory holds three things you will use: `BLOCKS.md` (every field of every block), `example.payload.json` (a complete, valid document to model yours on), and `validate.mjs` (the pre-flight check).

## What the reader needs

A document can read well and still fail because the number the reader came for is missing. Before writing, find the row for the kind of work and collect each fact it lists.

| Kind of work | Facts the reader needs | Blocks that carry them |
| --- | --- | --- |
| Performance, load, or capacity | The target, and the machine or plan it runs on with its size and price. The result against the target, before and after, measured the same way. How each number was measured: tool, load, data size, runs, and spread. Where the time or the resources go. Each fix, shown as code. How cost grows with users or data. The money cost now and at the target. What was not measured. | `stat`, `table`, `histogram`, `scatter`, `bigo`, `ba`, `coverage` |
| Bug, incident, or failed test | What the user saw. The cause, as a chain of steps. The fix. The proof that it works. What can still go wrong. | `seq`, `state`, or a `mermaid` flowchart, then `ba`, `good`, `warn` |
| Code review | What the change is for, in the user's terms. The verdict. Findings by severity, each with its effect on users. The code behind each blocking finding, and its fix. What the tests cover, and which checks fail. | `table`, `code` or `ba`, `coverage` |
| A change you made | What changed for the user. How it works now. What changed where. How you checked it. What is left. | `mermaid` or `layers`, `table`, `ba`, `coverage` |
| How something works | What each part is. How a request or a record moves through the parts. Its states. Its data. | `mermaid` flowchart, `seq`, `state`, `erd` |
| Deployment, migration, or rollout | The target layout. The steps in order, with who does each. The risks. How to roll back. The cost. | `mermaid`, `table`, `warn` |
| Database design | The tables and how they relate. Example rows. The queries it must serve. | `erd`, `table`, `code` |
| Choosing between options | What each option is. The same criteria applied to every option. Cost and effort. Your recommendation and its downside. | `table` with one row per criterion, `compare` for two options, a decision |

Three rules hold for every kind of work. A claim about code shows the few lines of code in a `code` or `ba` block instead of naming a file and a line; code shown as it is today is copied from the source, and code you propose says whether you ran it. An equation comes with its variables explained and one worked example. A number comes with what it is measured against, such as the target, the previous value, or the limit.

## Writing for the reader

- **Lead with the point.** The first sentence of each section is its conclusion. Evidence and method follow it, and long evidence goes in a `details` block.
- **One topic per paragraph.** Six sentences at most, usually two or three, with the topic in the first sentence. A paragraph that counts "first ..., second ..., third ..." is a `list`, or a `table` with one row per item when each item has more than one attribute. The validator hints at any paragraph over 400 characters.
- **Explain or cut every name the reader has not met.** That covers file paths, function and variable names, ticket and PR numbers, decision ids, and the labels you made up while working, such as lanes, phases, or cards. Say what the thing is or does in plain words: "the function that saves the host settings", not `config.SaveHost`. When the reader needs the exact path to act or to check, put it in a table column, a code block's `filename`, or a `details` block. A domain term the reader needs but may not know goes in the `glossary`, so its definition shows where the term appears.
- **Make the document stand alone.** If it follows an earlier document or conversation, restate in one sentence what that one found or decided. Never point to "the card" or "last round".
- **Leave out how you worked.** Subagents, lanes, verifiers, worktrees, the commands you ran, and the folders your notes live in mean nothing to the reader. Give the result. If the method changes how far to trust it, say so in one sentence or put it in a `details` block.
- **Say how facts relate.** The reader takes two facts placed side by side as cause and effect. If they are unrelated, say so, or keep them apart.
- **Mark uncertainty once.** Say which numbers are estimates in one place, such as a stat hint or a `coverage` block of what was not checked. A parenthesis in every clause buries the result.
- **Write in the language the human uses most with you, the way you would say it to a colleague.** If they mostly write Thai, write the document in Thai from the first draft, even when the code, your notes, and your own reasoning are in English. A translated English draft keeps English grammar and reads as a translation. See "Writing in Thai" below.
- **Only paragraphs and callouts render inline markdown.** In a `p` and in the title and text of a `note`, `warn`, or `good`, the reader renders `` `inline code` ``, `**bold**`, and `*italic*`. Nothing nests, and links are not rendered. Every other field, such as a table cell, a list item, a decision, or a label, shows exactly as typed, so backticks and asterisks there appear as literal characters. Put longer code in a `code` block.
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

### Writing in Thai

- Keep in English the terms Thai engineers say in English: API, PR, merge, branch, commit, deploy, migration, cache, endpoint, CPU, container, login, autosave. Use Thai for the rest: ข้อที่พบ, not finding; ผู้เขียน PR, not author; ตรวจแล้ว, not verify แล้ว.
- End a Thai sentence with a space, not a full stop.
- Use the words the product itself uses. If the screen says โลก, write โลก, not world.
- Check words that change meaning in Thai. เทอม means a school term, so a term of an equation is พจน์. ค่าใช้จ่าย means money, so CPU overhead is ภาระ CPU.
- Keep one voice. Use the same word for yourself from start to end, and call the reader คุณ.

| Translated from English | Written in Thai |
| --- | --- |
| lint และ sync:docs:check ผ่าน. ยัง merge แบบนี้ไม่ได้ | lint และการตรวจเอกสารผ่านแล้ว แต่ยัง merge ไม่ได้ |
| ข้อเหล่านี้ author รู้และตัดออกจาก scope ไว้แล้ว. | ผู้เขียน PR รู้เรื่องเหล่านี้ และตั้งใจไม่แก้ใน PR นี้ |
| PR พา frontend เข้าใกล้ contract v2 | PR นี้แก้หน้าเว็บให้ส่งข้อมูลตรงกับสเปก API ฉบับที่ 2 มากขึ้น |
| เทอมต่อนักเรียนที่กำลังทำมาจาก autosave | ภาระ CPU ต่อนักเรียนที่กำลังทำแบบประเมิน ส่วนใหญ่มาจาก autosave |

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

May be empty, and then the reader shows no decision area. Each decision needs `id`, `q`, `multi`, and at least two `opts`. Set `multi` to `false` for an either-or choice and `true` when several options can be taken together. The optional `refs` field lists the ids of the sections that set the decision up. The full field reference, including the two fields agents habitually get wrong (`cmp` and `dia`), is in `BLOCKS.md`.

### `glossary`

Optional. An array of at most 60 entries, each with a `term`, a `def` of at most 400 characters, and up to five `aliases`. The reader underlines the first use of each term in each section and shows the definition on hover or tap. It looks for terms only in paragraphs and in `note`, `warn`, and `good` callouts. Leave the key out when there is nothing to define. The fields and the matching rules are in `BLOCKS.md`.

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

Hints are the third kind of line, and they never change the exit code. Each one names a pattern that makes the document hard to read for someone who did not follow the work: a paragraph over 400 characters, an English sentence over 25 words, a table cell over 200 characters, a stat label or hint over 50, a file path in running text, or markdown that the field does not render: a link anywhere, or backticks and `**` outside a paragraph or callout.

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
| 404 | `{ "error": "Session not found or expired." }` | The id is wrong or the session has expired. |
| 403 | `{ "error": "This session is protected..." }` | The reader encrypted it; the content is no longer readable by you. |

### Uploading an image

An `image` block names an image the API already holds. Upload each file first, then put the returned `imageId` in the block, then create the brief.

```bash
curl -sS -X POST https://brief-api.algoryth.me/api/image \
  -H 'content-type: image/png' \
  --data-binary @screenshot.png
```

Send the raw bytes of the file as the body, with `--data-binary`, not a form or JSON, and set the `content-type` header to the image type of the file. The API does not trust that header. It reads the first bytes of the file instead: it accepts PNG, JPEG, GIF, and WEBP, and nothing else. SVG is refused. A file may hold at most 5242880 bytes (5 MiB).

| Status | Body | What to do |
| --- | --- | --- |
| 201 | `{ "imageId": "Vb7kQ2nR9xLm4TzA", "contentType": "image/png", "bytes": 48213 }` | Put `imageId` in the `image` block as it is. |
| 400 | `{ "error": "Image body is empty." }` | Send the file bytes with `--data-binary @file`. |
| 413 | `{ "error": "Image exceeds 5242880 bytes." }` | Shrink or crop the image, or save it as JPEG or WEBP. |
| 415 | `{ "error": "Unsupported image type. Upload PNG, JPEG, WebP or GIF." }` | Convert the file to one of those four formats. An SVG must become a PNG. |
| 429 | `{ "error": "Rate limit exceeded. Try again in a minute." }` | Ten uploads per 60 seconds per IP. Wait a minute, then upload the rest. |

An upload is held unlinked. The brief links it when `POST /api/session` creates a brief that names the `imageId` in an `image` block, at the top level of a section or inside a `details`, within one hour of the upload. An upload that no brief names within that hour is deleted. A linked image lives and expires with its brief, and one upload links to one brief only, so upload the file again for a second brief. The API links at most 50 images per brief.

Until a brief links it, the API never serves the image, so `GET /api/image/<imageId>` returns 404 `{ "error": "Image not found or expired." }` straight after the upload. That is expected; do not retry. A brief that names an unknown, expired, or already linked id still publishes, and the reader shows "Image is missing or has expired." in that block.

### Reading a document back

`GET https://brief-api.algoryth.me/api/session/<id>/raw` returns the document as markdown. It contains only the payload you sent, never the reader's annotations or answers, and it returns 403 once the reader password-protects the session. Keep your own copy of any payload you may need later rather than relying on this endpoint.

## What comes back

The reader replies by pasting a generated prompt into this conversation. There are two shapes, both plain text. Recognise them and act; do not ask the human to restate them.

**Decision answers**, generated from the decision dock, one block per decision:

```text
Reply to the "Rate limiting for /api/session" doc (session aB3xYz01qWe9rT) - my decisions:

[limiter-choice] Which rate limiter should we put in front of POST /api/session?
  - Choice: Cloudflare Rate Limiting binding
  - Note: Ship it behind a flag.

[rollout] How should the limit reach production?
  - Choice: Shadow mode for one week; Alert on sustained 429s

Please act on the answers above; consider the extra context for any item that has a note
```

The bracketed name is the decision `id` you set. `Choice` holds option **labels**, semicolon-separated when `multi` is true, or `(not answered)`. A `Note` is free text the reader added, and it usually carries a constraint that changes the work; treat it as part of the answer, not as decoration.

**A question about a passage**, generated when the reader highlights text and asks about it:

```text
Question about a specific part of the "Rate limiting for /api/session" doc (session aB3xYz01qWe9rT).

Reference:
- URL: https://brief.algoryth.me/s/aB3xYz01qWe9rT#evidence
- Location: section 02 "What the traffic shows" - paragraph 3 - chars 41-118
- Quoted text: "the free D1 tier throttles within four minutes"

Question:
Where does the four minute figure come from?

Please answer specifically about the quoted part above, using the reference to locate it.
```

Answer the quoted passage specifically. If the answer changes a claim in the document, say so plainly: a published document is immutable, so a correction lives in the conversation or in a new document.

When the document has decisions, design them so this loop closes in one pass. A question the human cannot settle from the document alone is a question that comes back as another round trip.

## Common mistakes

| Mistake | Reality |
| --- | --- |
| A file path, function name, or line number in a sentence | The reader does not know it. Say what the thing does. Put the path in a table column, a code block's `filename`, or a `details` block, and show the code itself when the claim is about code. |
| An id the reader has never seen: a ticket, a card, a lane, an earlier document | Explain it in words or cut it. Each document stands alone. |
| Telling the story of how you worked | The reader wants the result. Give the method one sentence, or a `details` block when it affects how far to trust the result. |
| A performance or capacity document with no setup, no before and after, no complexity, or no money cost | See "What the reader needs". Those are the facts the reader came for. |
| Handing the human a question you could settle | Decide it, say what you chose, and keep decisions for calls that turn on their priorities, money, risk, or taste. |
| Writing in English and translating into Thai | The translation keeps English grammar, full stops, and calques. Write in Thai from the first draft. |
| A sentence that carries two ideas, or a passive copied from English | Split it, and name who does the action. ASD-STE100 keeps a description to 25 words and an instruction to 20. |
| Backticks or `**` in a table cell, a list item, a label, or a decision | Only a `p` and the title and text of a `note`, `warn`, or `good` render inline code, bold, and italic. Everywhere else they show as literal characters. Links render nowhere. |
| A URL, a file path, or a data URI in an image's `imageId` | `imageId` takes only the id that `POST /api/image` returned. Upload the file first. |
| Uploading an image and creating the brief more than an hour later | An upload no brief names within one hour is deleted, and the block shows a missing image. Upload, then create the brief right away. |
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
| `"tone": "red"` on a table cell, state, or transition, or `"tone": "bad"` on a stat tile | Table cells, states, and transitions take `info`, `good`, `warn`, or `bad`. Stat tiles take the colour names `mauve`, `blue`, `green`, `red`, `peach`, `teal`, or `yellow`. |
| Counting the header row in a table's `cells`, or counting `cells` and a histogram `threshold.bin` from 0 | `row: 1` is the first array in `rows`. Rows, columns, and bins count from 1. A position outside the table or past the last bin is ignored without an error. |
| A one-column `table` for a list of steps | Use a `list` block with `ordered: true`. |
| Explaining a flow, a comparison, or a set of numbers in paragraphs | Use the block built for that shape, and keep the paragraph for what the block cannot say, such as why it matters. |
| A block that repeats the paragraph beside it | Keep whichever carries the fact better and cut the other. |
| Adding a decision so the document has one | `"decisions": []` is a complete document. A decision is for a choice the human owns, with at least two options you would accept. |
| Publishing unverified claims | Every number and path must come from the research phase. A confident wrong document is worse than no document. |
| Retrying a 429 in a loop | Ten creations per minute. Fix the payload offline, then POST once. |
| POSTing without running `validate.mjs` | The script is offline and free; a rejected POST is not. Validate, then publish. |
| Ignoring a warning from `validate.mjs` | A warning is a field the API strips and the reader never sees, such as `color` where the schema says `tone`. The block publishes silently broken. |
