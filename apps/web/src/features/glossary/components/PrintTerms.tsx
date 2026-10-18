import type { Payload } from '@brief/schema'

/** B-Print "Terms", after "Your answers": every glossary entry under its print
 * number, which is its place in the glossary array. */
export function PrintTerms({ glossary }: { glossary: Payload['glossary'] }) {
  if (!glossary?.length) return null
  return (
    <section data-print-terms="" className="mt-8 hidden print:block">
      <h2 className="m-0 mb-[10px] border-t-2 border-text pt-[14px] text-[21px] leading-[28px] font-semibold">Terms</h2>
      <dl className="m-0 mb-8 text-[14px] leading-[22px]">
        {glossary.map((g, i) => (
          <div key={i}>
            <dt className="font-semibold">
              <sup className="font-mono text-[11px]">{i + 1}</sup> {g.term}
            </dt>
            <dd className="m-0 mb-2 ml-4">{g.def}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
