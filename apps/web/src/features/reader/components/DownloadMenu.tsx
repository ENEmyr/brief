'use client'
import { TopbarMenu } from './TopbarMenu'
import type { TopbarMenuItem } from './TopbarMenu'

/**
 * One Download control in place of the two separate Markdown and Print / PDF
 * buttons. Both are the same reader intent ("give me this doc as a file"), and
 * collapsing them frees a slot in a topbar that is already tight at the
 * 880px breakpoint where every label hides.
 *
 * Each handler is optional and an absent one drops its menu item; with
 * neither, TopbarMenu renders nothing. The trigger/panel/focus/keyboard
 * mechanics live once in TopbarMenu; this component only supplies its own
 * icon, label, and items.
 */
export function DownloadMenu({
  onDownload,
  onPrint,
}: {
  onDownload?: () => void
  onPrint?: () => void
}) {
  const items: TopbarMenuItem[] = []
  if (onDownload) items.push({ icon: '↓', label: 'Markdown (.md)', run: onDownload })
  if (onPrint) items.push({ icon: '⎙', label: 'Print / PDF', run: onPrint })

  return <TopbarMenu triggerIcon="↓" triggerLabel="Download" items={items} />
}
