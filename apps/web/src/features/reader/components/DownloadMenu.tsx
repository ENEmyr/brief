'use client'
import { TopbarMenu } from './TopbarMenu'
import type { TopbarMenuItem } from './TopbarMenu'
import { DownloadIcon } from './icons'
import { ICON_BUTTON } from './topbarChrome'

/**
 * One Download control for both files a reader can take away (Markdown and
 * Print / PDF): the same reader intent, one slot in a tight top bar.
 *
 * Each handler is optional and an absent one drops its menu item; with
 * neither, TopbarMenu renders nothing. Item labels are B-Components' menu.
 */
export function downloadItems(onDownload?: () => void, onPrint?: () => void): TopbarMenuItem[] {
  const items: TopbarMenuItem[] = []
  if (onDownload) items.push({ label: 'Markdown', run: onDownload })
  if (onPrint) items.push({ label: 'PDF', run: onPrint })
  return items
}

export function DownloadMenu({
  onDownload,
  onPrint,
}: {
  onDownload?: () => void
  onPrint?: () => void
}) {
  return (
    <TopbarMenu
      icon={<DownloadIcon />}
      triggerLabel="Download"
      triggerClassName={ICON_BUTTON}
      items={downloadItems(onDownload, onPrint)}
    />
  )
}
