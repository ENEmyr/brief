import { API_BASE_URL, DOCS_URL, READER_URL, REPO_URL, UPDATE_COMMAND } from '../lib/content'
import { FOCUS_RING } from '../lib/styles'

const FACTS = [
  { term: 'Reader', detail: READER_URL, href: READER_URL },
  { term: 'API', detail: API_BASE_URL, href: `${API_BASE_URL}/api/health` },
  { term: 'Source', detail: 'github.com/ENEmyr/brief', href: REPO_URL },
  { term: 'Docs', detail: 'Schema, ADRs, architecture', href: DOCS_URL },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-[1080px] px-6 py-12">
        <dl className="grid gap-6 min-[880px]:grid-cols-4">
          {FACTS.map((fact) => (
            <div key={fact.term}>
              <dt className="font-mono text-[10.5px] tracking-wide text-faint uppercase">
                {fact.term}
              </dt>
              <dd className="mt-1.5">
                <a
                  href={fact.href}
                  className={`text-[14px] break-words text-text hover:text-mauve ${FOCUS_RING}`}
                >
                  {fact.detail}
                </a>
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-10 border-t border-line pt-6 text-[13px] text-sub">
          Already installed? New block types arrive with{' '}
          <code className="rounded-md bg-chip px-1.5 py-0.5 font-mono text-[12.5px] text-text">
            {UPDATE_COMMAND}
          </code>
          . Unsaved documents live 7 days, archived ones 90, and every open resets the window.
        </p>
      </div>
    </footer>
  )
}
