'use client'
import { useGlossary } from './GlossaryProvider'

/** B-Print "Terms": every glossary entry under its print number. */
export function PrintTerms() {
  const { index } = useGlossary()
  if (index.terms.length === 0) return null
  return (
    <section data-print-terms="" className="mt-8 hidden print:block">
      <h2 className="m-0 mb-[10px] border-t-2 border-text pt-[14px] text-[21px] leading-[28px] font-semibold">Terms</h2>
      <dl className="m-0 mb-8 text-[14px] leading-[22px]">
        {index.terms.map((t) => (
          <div key={t.n}>
            <dt className="font-semibold">
              <sup className="font-mono text-[11px]">{t.n}</sup> {t.term}
            </dt>
            <dd className="m-0 mb-2 ml-4">{t.def}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
