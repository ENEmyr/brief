'use client'
import { defaultCopyText } from '@/shared/clipboard'

/** Prompt review panel (Reader.dc.html lines 830-843): mauve-bordered card
 * shown once "Generate prompt" produces reply-prompt text. Header has a
 * close button; body is a hint line plus an editable textarea (the
 * textarea keeps whatever the caller passes as `text` -- DecisionSection
 * owns that state, so user edits persist until the caller explicitly
 * rebuilds); footer has a solid "Copy prompt" and an outline "Rebuild from
 * answers". The textarea reuses the `--code-bg` token (dark panel
 * regardless of app theme, same as CodePre's shiki panel) rather than the
 * prototype's literal `this.state.dark ? '#11111b' : '#1e1e2e'` branch. */
export function PromptReview({
  text,
  onChange,
  onRebuild,
  onClose,
  onCopied = () => {},
  copyText = defaultCopyText,
}: {
  text: string
  onChange: (text: string) => void
  onRebuild: () => void
  onClose: () => void
  onCopied?: () => void
  copyText?: (text: string) => void
}) {
  function handleCopy() {
    copyText(text)
    onCopied()
  }

  return (
    <div className="mt-[18px] overflow-hidden rounded-xl border border-mauve bg-card">
      <div className="flex items-center justify-between border-b border-line bg-mauvesoft px-4 py-[11px]">
        <span className="text-[13.5px] font-semibold text-mauve">✦ Review prompt before copying</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close prompt review"
          className="max-[879px]:min-h-11 max-[879px]:min-w-11 cursor-pointer rounded-md border-0 bg-transparent font-[inherit] text-base text-sub"
        >
          ✕
        </button>
      </div>
      <div className="p-4">
        <p className="m-0 mb-2.5 text-[12.5px] text-sub">
          Edit the text below as you like, then copy it into Claude Code
        </p>
        <textarea
          value={text}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Prompt text"
          className="min-h-[230px] w-full resize-y rounded-[10px] border border-line p-3.5 font-mono text-[12.5px] leading-[1.65]"
          style={{ background: 'var(--code-bg)', color: '#cdd6f4' }}
        />
        <div className="mt-3 flex gap-2.5">
          <button
            type="button"
            onClick={handleCopy}
            className="max-[879px]:min-h-11 rounded-[9px] border-0 bg-mauve px-5 py-2.5 font-[inherit] text-[14px] font-bold text-white"
          >
            ⧉ Copy prompt
          </button>
          <button
            type="button"
            onClick={onRebuild}
            className="max-[879px]:min-h-11 rounded-[9px] border border-line bg-card px-4 py-2.5 font-[inherit] text-[13.5px] text-sub"
          >
            ↻ Rebuild from answers
          </button>
        </div>
      </div>
    </div>
  )
}
