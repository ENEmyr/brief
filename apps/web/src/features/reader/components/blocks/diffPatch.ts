export type PatchLineKind = 'hunk' | 'add' | 'del' | 'ctx'

export interface PatchLine {
  kind: PatchLineKind
  text: string
}

/** One unified-diff line per row, classified by its leading marker. File headers (`+++`, `---`) are context. */
export function parsePatch(patch: string): PatchLine[] {
  return patch.split('\n').map((text) => ({ kind: lineKind(text), text }))
}

function lineKind(text: string): PatchLineKind {
  if (text.startsWith('@@')) return 'hunk'
  if (text.startsWith('+') && !text.startsWith('+++')) return 'add'
  if (text.startsWith('-') && !text.startsWith('---')) return 'del'
  return 'ctx'
}

export function patchCounts(lines: readonly PatchLine[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const line of lines) {
    if (line.kind === 'add') added += 1
    else if (line.kind === 'del') removed += 1
  }
  return { added, removed }
}
