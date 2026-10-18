import { createContext } from 'react'
import type { StoredBlock, StoredSection } from '@brief/schema'

export type DiffNodeStatus = 'added' | 'modified' | 'deleted'

/** The status of each diff-map node in the brief, by id, for a layers node that names one (`diffNode`). */
export const DiffNodeStatusContext = createContext<ReadonlyMap<string, DiffNodeStatus>>(new Map())

export function collectDiffNodeStatus(sections: readonly StoredSection[]): Map<string, DiffNodeStatus> {
  const statuses = new Map<string, DiffNodeStatus>()
  const visit = (blocks: readonly StoredBlock[]) => {
    for (const block of blocks) {
      if (block.type === 'diff') {
        for (const node of block.map?.nodes ?? []) {
          if (node.status !== undefined && !statuses.has(node.id)) statuses.set(node.id, node.status)
        }
      } else if (block.type === 'details') {
        visit(block.blocks)
      }
    }
  }
  for (const section of sections) visit(section.blocks)
  return statuses
}
