/** The dock's empty state (B-States:115-118). */
export function NoDecisionsNote() {
  return (
    <div className="flex flex-col gap-2 rounded-panel border border-line bg-card p-[14px] leading-[normal]">
      <span className="font-mono text-[11px] tracking-[.06em] text-faint">DECISIONS</span>
      <p className="m-0 text-[13px] leading-5 text-sub">
        This brief asks nothing. Read it, highlight what matters, then copy your notes back with{' '}
        <b className="font-bold text-text">Edit &gt; Copy edit prompt</b>.
      </p>
    </div>
  )
}
