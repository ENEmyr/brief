'use client'
import { TopbarMenu } from './TopbarMenu'
import type { TopbarMenuItem } from './TopbarMenu'

/**
 * Edit control, built on the same TopbarMenu shell as Download. Ships with
 * one live item -- "Copy edit prompt", which serializes every
 * highlight/note/question and decision answer into a prompt the reader hands
 * to an AI agent -- because the user's other ask, a manual in-place editor,
 * is deferred to its own feature request. Kept as a menu rather than a flat
 * button precisely so that second item can slot in later without
 * restructuring this control.
 */
export function EditMenu({ onCopyPrompt }: { onCopyPrompt?: () => void }) {
  const items: TopbarMenuItem[] = []
  if (onCopyPrompt) items.push({ icon: '⧉', label: 'Copy edit prompt', run: onCopyPrompt })

  return (
    <TopbarMenu triggerIcon="✎" triggerLabel="Edit" items={items} panelWidthClassName="w-[220px]" />
  )
}
