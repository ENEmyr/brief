# apps/web

Statically exported Next.js reader UI. See the root CLAUDE.md for repo-wide rules.

## Layout

- `src/features/<feature>/` holds each vertical slice (reader, annotations, decisions, save, export, toc, theme, reader-state, diagram-viewer). Inside a slice, code splits into `components/`, `hooks/`, `lib/`, and `services/` as needed. Each slice exposes its public API through `index.ts`; import other features only via `@/features/<feature>`.
- `src/shared/` holds cross-feature helpers: `api.ts` (API base URL) and `clipboard.ts`.
- `src/app/` is the Next.js app router shell, including `globals.css`.

## Conventions

- Use semantic color tokens (`page`, `card`, `elev`, `line`, `sub`, `chip`, and friends) rather than raw Catppuccin palette variables. Tokens are defined in `src/app/globals.css` for both the latte and mocha themes.
- The narrow-screen breakpoint is 880px, written as `min-[880px]:` and `max-[879px]:` variants. Never use `lg:`.
- Interactive controls need a 44px minimum touch target on narrow screens: `max-[879px]:min-h-11` (plus `min-w-11` where relevant).
- Heavy renderers (echarts, shiki, katex, mermaid) load lazily via `next/dynamic` or `import()` so they stay out of the first-load chunks. Keep new heavy dependencies behind the same boundaries.
- Every `dangerouslySetInnerHTML` sink sanitizes its input with DOMPurify and carries a one-line `nosemgrep` justification comment.
- Tests live in `apps/web/test`, mirroring the feature layout, using vitest and testing-library.

## Testing gotcha

Never assert synchronously on side effects that run in passive effects triggered by non-act async continuations (for example a localStorage scrub after an awaited fetch). Wrap the assertion in `waitFor`. This is a real bug class from this repo's history (see the bug-250 save test).

## Protected sessions

Reader state for protected (end-to-end encrypted) sessions is memory-only. Nothing payload-derived may reach localStorage or the state endpoint once a session is encrypted, including sessions that become protected mid-view. See `src/features/reader-state` before touching any persistence path.
