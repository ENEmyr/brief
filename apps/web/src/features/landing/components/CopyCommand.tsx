'use client'
import { useState } from 'react'
import { copyText } from '@/shared/clipboard'
import { FOCUS_RING } from '../lib/styles'

/**
 * The install command, presented as the thing a developer actually does with
 * it: a control that puts it on the clipboard. The label reverts after two
 * seconds so the button never lies about the current state of the clipboard.
 */
export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    const result = await copyText(command)
    if (result !== 'copied') return
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={`group flex min-h-11 items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 text-left transition-colors hover:border-mauve ${FOCUS_RING}`}
    >
      <span aria-hidden="true" className="font-mono text-[13px] text-faint">
        $
      </span>
      <code className="font-mono text-[13px] text-text">{command}</code>
      <span className="ml-auto font-mono text-[11px] tracking-wide text-sub uppercase group-hover:text-mauve">
        {copied ? 'Copied' : 'Copy'}
      </span>
    </button>
  )
}
