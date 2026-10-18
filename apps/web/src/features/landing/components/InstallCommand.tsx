import { INSTALL_COMMAND } from '../lib/content'
import { CopyButton } from './CopyButton'

export function InstallCommand() {
  return (
    <div className="flex min-h-[50px] items-center gap-[10px] rounded-[6px] border border-line2 bg-card pr-[6px] pl-[14px] font-mono text-[14px]">
      <span className="text-accent-text">$</span>
      {INSTALL_COMMAND}
      <CopyButton
        text={INSTALL_COMMAND}
        label="Copy install command"
        className="min-h-9 rounded-[4px] border-0 bg-elev px-[10px] max-[880px]:min-h-11"
      />
    </div>
  )
}
