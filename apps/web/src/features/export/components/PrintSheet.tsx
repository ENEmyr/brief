import type { Decision, Payload } from '@brief/schema'
import { otherLabel } from '@/features/decisions'
import type { ReaderState } from '@/features/reader-state'
import { printedLine, sessionLine, type PrintSnapshot } from '../lib/printSheet'

const RULE_HEADING = 'm-0 border-t-2 border-text pt-[14px] text-[21px] leading-[28px] font-semibold'
const CELL = 'border-b border-line2 px-2 py-[6px] align-top'
const HEAD_CELL = 'border-b border-text px-2 py-[6px] text-left font-semibold'

/** The title block of B-Print:21-23, which replaces the reader's header card on paper. */
export function PrintHeader({
  payload,
  sessionId,
  snapshot,
}: {
  payload: Payload
  sessionId: string
  snapshot: PrintSnapshot
}) {
  return (
    <div data-print-sheet="" className="mb-7 hidden print:block">
      <h1 className="m-0 mb-2 text-[30px] leading-[38px] font-semibold tracking-[-0.02em]">{payload.meta.title}</h1>
      <p className="m-0 mb-[6px] font-mono text-[12px] leading-[18px] text-sub">
        {sessionLine(sessionId, payload, snapshot.state)}
      </p>
      <p className="m-0 font-mono text-[12px] leading-[18px] text-sub">
        {printedLine(snapshot.printedAt, snapshot.url)}
      </p>
      {payload.meta.subtitle && (
        <p className="m-0 mt-[14px] text-[16px] leading-[1.6]">{payload.meta.subtitle}</p>
      )}
    </div>
  )
}

function Answer({ decision, state }: { decision: Decision; state: ReaderState }) {
  const picked = new Set(state.dsel[decision.id] ?? [])
  const labels = decision.opts.filter((opt) => picked.has(opt.id)).map((opt) => opt.label)
  const otherPicked = otherLabel(decision, state) !== undefined
  if (labels.length === 0 && !otherPicked) return <b>(not answered)</b>
  return (
    <>
      {labels.join('; ')}
      {otherPicked && (
        <>
          {labels.length > 0 && '; '}
          <i>Other:</i> {(state.dother[decision.id] ?? '').trim()}
        </>
      )}
    </>
  )
}

/** "Your answers" at the end of the printout (B-Print:87-97), every decision including open ones. */
export function PrintAnswers({ decisions, state }: { decisions: Decision[]; state: ReaderState }) {
  if (decisions.length === 0) return null
  return (
    <section data-print-answers="" className="mt-8 hidden print:block">
      <h2 className={`${RULE_HEADING} mb-[6px]`}>Your answers</h2>
      <p className="m-0 mb-[10px] text-[14px] leading-[22px] text-sub">
        As of printing. Open questions are marked so a printed copy is never mistaken for a finished one.
      </p>
      <table className="mb-8 w-full border-collapse text-[14px] leading-5">
        <thead>
          <tr>
            <th className={`${HEAD_CELL} w-[52px]`}>id</th>
            <th className={HEAD_CELL}>question</th>
            <th className={HEAD_CELL}>answer</th>
            <th className={HEAD_CELL}>note</th>
          </tr>
        </thead>
        <tbody>
          {decisions.map((d) => (
            <tr key={d.id}>
              <td className={`${CELL} font-mono`}>{d.id}</td>
              <td className={CELL}>{d.q}</td>
              <td className={CELL}>
                <Answer decision={d} state={state} />
              </td>
              <td className={CELL}>{(state.dnote[d.id] ?? '').trim()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
