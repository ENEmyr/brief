import { EXAMPLE_ID, EXAMPLE_LINK } from '../lib/content'
import styles from './landing.module.css'

const PANEL = 'flex flex-col rounded-[8px] border border-line bg-card'
const PANEL_HEAD = 'border-b border-line px-[14px] py-[10px] font-mono text-[11px] text-faint'
const OPTION = 'rounded-[3px] border px-[6px] py-[5px]'

/** Three panels: the agent's terminal, the brief, the prompt that goes back (B-Landing:46-83). */
export function Triptych({ className }: { className: string }) {
  return (
    <div className={`${className} grid grid-cols-[repeat(auto-fit,minmax(min(360px,100%),1fr))] gap-4`}>
      <div className={PANEL}>
        <div className={PANEL_HEAD}>claude code</div>
        <div className="flex flex-col gap-[6px] p-4 font-mono text-[13px] leading-[22px] text-sub">
          <span>
            <span className="text-accent-text">&gt;</span> review the rate limiter plan
          </span>
          <span className="text-faint">· read 2 files · ran k6 · wrote brief</span>
          <span className="text-text">Reviewed the plan. Four calls need you:</span>
          <span>
            <span className={`${styles.type} text-accent-text`}>{EXAMPLE_LINK}</span>
          </span>
        </div>
      </div>

      <div className={PANEL}>
        <div className={`${PANEL_HEAD} flex justify-between`}>
          <span>{EXAMPLE_LINK}</span>
          <span className="text-accent-text">2/4</span>
        </div>
        <div className="flex">
          <div className="flex flex-1 flex-col gap-[10px] border-r border-line p-[14px]">
            <span className="text-[16px] font-semibold">Rate limiting for the public API</span>
            <div className="grid grid-cols-2 rounded-[4px] border border-line">
              <div className="p-2">
                <span className="text-[10px] text-sub">p95</span>
                <div className="font-mono text-[18px] text-bad">2.4 s</div>
              </div>
              <div className="border-l border-line p-2">
                <span className="text-[10px] text-sub">after</span>
                <div className="font-mono text-[18px] text-good">0.2%</div>
              </div>
            </div>
            <div className="h-[6px] w-[90%] rounded-[3px] bg-line" />
            <div className="h-[6px] w-[70%] rounded-[3px] bg-line" />
          </div>
          <div className="flex w-[170px] flex-col gap-1 p-[10px] text-[11px]">
            <span className="font-mono text-accent-text">D2</span>
            <span className={`${OPTION} border-line text-sub`}>1 60 / min</span>
            <span className={`${OPTION} border-accent-line bg-accent-soft`}>2 600 / min</span>
            <span className={`${OPTION} border-line text-sub`}>3 Per plan</span>
          </div>
        </div>
      </div>

      <div className={PANEL}>
        <div className={PANEL_HEAD}>back to the agent</div>
        <div className="p-4 font-mono text-[13px] leading-[22px] whitespace-pre-wrap text-sub">
          {`Reply to the "Rate limiting for the public API" doc (session ${EXAMPLE_ID}) - my decisions:\n\n`}
          <span className="text-text">[D2] Requests per minute per key</span>
          {'\n  - Choice: 600 / min\n  - Note: separate burst allowance for webhooks?\n\n'}
          <span className="text-text">[D3] What to key the limit on</span>
          {'\n  - Choice: API key; User ID'}
        </div>
      </div>
    </div>
  )
}
