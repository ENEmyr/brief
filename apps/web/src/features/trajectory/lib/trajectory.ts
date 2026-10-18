import type { StoredPayload, TrajectoryBlock } from '@brief/schema'
import type { ReaderState, TrajectoryMark } from '@/features/reader-state'

type Step = TrajectoryBlock['steps'][number]

/** Board labels for each kind (B-NewBlocks:258-263); `note` has no board row. */
export const KIND_LABEL: Record<Step['kind'], string> = {
  request: 'you said',
  read: 'read',
  run: 'bash',
  edit: 'edit',
  decision: 'decided',
  assumption: 'assumed',
  note: 'note',
}

export const MARK_LABEL: Record<TrajectoryMark, string> = { ask: 'Ask me', ok: 'OK' }

/**
 * Where a trajectory block's marks live in reader state. The payload gives the
 * block no id, so the key is its position: section, block, and for a block
 * nested in a details, the `blocks.<i>.` prefix Details hands its children.
 */
export function trajectoryKey(sid: number, bid: number, pathPrefix = ''): string {
  return pathPrefix === '' ? `${sid}.${bid}` : `${sid}.${bid}.${pathPrefix.slice(0, -1)}`
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Time since the first step, as the board draws it: `00:14`, `03:40`, `1:02:05`. */
export function offsetLabel(at: string, startAt: string): string {
  const seconds = Math.round((Date.parse(at) - Date.parse(startAt)) / 1000)
  const abs = Math.abs(seconds)
  const h = Math.floor(abs / 3600)
  const mmss = `${pad2(Math.floor((abs % 3600) / 60))}:${pad2(abs % 60)}`
  return `${seconds < 0 ? '-' : ''}${h > 0 ? `${h}:${mmss}` : mmss}`
}

/** `42s`, `4m 12s`, `1h 4m`. */
export function durationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

/** `980 tokens`, `38.2k tokens`, `1.2M tokens`. */
export function tokensLabel(tokens: number): string {
  const short = (n: number) => n.toFixed(1).replace(/\.0$/, '')
  if (tokens < 1000) return `${tokens} tokens`
  if (tokens < 1_000_000) return `${short(tokens / 1000)}k tokens`
  return `${short(tokens / 1_000_000)}M tokens`
}

/** The run's length: the agent's own count, else first step to last. */
export function totalSeconds(block: TrajectoryBlock): number {
  if (block.stats?.seconds !== undefined) return block.stats.seconds
  const first = block.steps[0]
  const last = block.steps.at(-1)
  if (!first || !last) return 0
  return Math.max(0, Math.round((Date.parse(last.at) - Date.parse(first.at)) / 1000))
}

function trajectories(payload: StoredPayload): { key: string; block: TrajectoryBlock }[] {
  return payload.sections.flatMap((section, sid) =>
    section.blocks.flatMap((block, bid) => {
      if (block.type === 'trajectory') return [{ key: trajectoryKey(sid, bid), block }]
      if (block.type !== 'details') return []
      return block.blocks.flatMap((inner, i) =>
        inner.type === 'trajectory' ? [{ key: trajectoryKey(sid, bid, `blocks.${i}.`), block: inner }] : [],
      )
    }),
  )
}

/** Flagged steps across the trajectory blocks, or null when the document has none (the outline then has no Agent trail row). */
export function trailFlagCount(payload: StoredPayload): number | null {
  const found = trajectories(payload)
  if (found.length === 0) return null
  return found.reduce((n, { block }) => n + block.steps.filter((step) => step.flag).length, 0)
}

/**
 * The copy-back prompt's "Flags" group: each flagged step the reader marked,
 * in document order, with its mark, offset, kind and title. Empty when nothing
 * is marked, so a prompt without marks reads as before.
 */
export function flagPromptLines(payload: StoredPayload, state: ReaderState): string[] {
  const lines = trajectories(payload).flatMap(({ key, block }) => {
    const marks = state.tflag?.[key]
    const first = block.steps[0]
    if (!marks || !first) return []
    return block.steps.flatMap((step, i) => {
      const mark = marks[String(i)]
      if (!mark || !step.flag) return []
      return [`  - ${MARK_LABEL[mark]}: ${offsetLabel(step.at, first.at)} ${KIND_LABEL[step.kind]} - ${step.title}`]
    })
  })
  if (lines.length === 0) return []
  return ['Flags (steps the agent decided alone or assumed):', ...lines, '']
}
