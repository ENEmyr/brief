import type { SaveStatus } from '@/features/reader-state'
import { LockIcon } from './icons'

/** B-States "top bar save chip": one row per state. */
const CHIP: Record<SaveStatus, { label: string; tone: string; dot: string | null; title?: string }> = {
  saved: {
    label: 'saved',
    tone: 'border-line text-sub',
    dot: 'bg-good',
    title: 'Answers saved on this device and synced',
  },
  saving: { label: 'saving', tone: 'border-line text-sub', dot: 'save-pulse bg-info' },
  device: { label: 'this device', tone: 'border-warn-line text-warn', dot: 'bg-warn' },
  tab: { label: 'this tab only', tone: 'border-bad-line text-bad', dot: null },
}

export function SaveChip({ status, className = '' }: { status: SaveStatus; className?: string }) {
  const chip = CHIP[status]
  return (
    <span
      role="status"
      aria-live="polite"
      title={chip.title}
      className={`box-content flex h-7 shrink-0 items-center gap-[6px] rounded-[4px] border px-2 font-mono text-[12px] leading-[normal] ${chip.tone} ${className}`}
    >
      {chip.dot ? (
        <span aria-hidden="true" className={`h-[6px] w-[6px] rounded-full ${chip.dot}`} />
      ) : (
        <LockIcon />
      )}
      {chip.label}
    </span>
  )
}
