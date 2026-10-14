import { PREVIEW_CALLOUTS } from '../lib/content'
import { BAND, H2, PAD, PREVIEW_TEXT } from '../lib/styles'
import { LogoTile } from './SiteHeader'

const BADGE_LOOK =
  'shrink-0 items-center justify-center rounded-full bg-accent font-mono text-[11px] font-semibold text-on-accent'
const BADGE = `flex h-[18px] w-[18px] ${BADGE_LOOK}`
const OUTLINE_NO = 'font-mono text-[11px]'
const OPTION = 'flex min-h-[34px] items-center gap-2 rounded-[4px] border px-2'
const KBD = 'flex items-center justify-center rounded-[3px] font-mono text-[10px]'
const NODE = 'absolute top-2 flex h-8 w-[120px] items-center justify-center rounded-[4px] border'
const LIFELINE = 'absolute top-10 h-[130px] w-0 border-l border-dashed border-line2'
const MESSAGE = 'absolute w-[160px] text-center font-mono text-[11px]'

/** One horizontal message arrow of the seq card, drawn as the board draws it (B-Landing:173-175). */
function Arrow({ id, left, top, color, dashed, back }: { id: string; left: number; top: number; color: string; dashed?: boolean; back?: boolean }) {
  return (
    <svg
      width="179"
      height="8"
      viewBox="0 0 179 8"
      preserveAspectRatio="none"
      className="absolute overflow-visible"
      style={{
        left,
        top,
        fill: 'none',
        stroke: color,
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeDasharray: dashed ? '5 4' : undefined,
      }}
    >
      <defs>
        <marker id={id} orient="auto" markerWidth="5" markerHeight="5" refX="2" refY="2" overflow="visible">
          <path d="M0 0 L4 2 L0 4 Z" style={{ stroke: 'none', fill: 'context-stroke' }} />
        </marker>
      </defs>
      <path d={back ? 'M 179 4 L 4 4' : 'M 0 4 L 175 4'} markerEnd={`url(#${id})`} />
    </svg>
  )
}

/**
 * The annotated reader on B-Landing:143-202, built from the reader's own
 * parts at preview scale. It shows the three view tabs of the shipped reader
 * (owner ruling D2), not the board's four.
 */
export function ReaderPreview() {
  return (
    <section id="preview" className={`border-t border-line ${BAND}`}>
      <div className={`mx-auto flex max-w-[1280px] flex-col gap-6 py-[72px] ${PAD}`}>
        <div className="flex flex-col gap-2">
          <h2 className={H2}>What you get back</h2>
          <p className="m-0 max-w-[680px] text-[16px] leading-[26px] text-sub">
            A reading workspace, not a report. The question you are answering always sits next to the part of the
            document it is about.
          </p>
        </div>

        <div role="img" aria-label="Preview of a brief" className="overflow-hidden rounded-[8px] border border-line bg-page">
          <div className="flex h-[45px] items-center gap-3 border-b border-line bg-card px-3 text-[13px]">
            <LogoTile size="preview" />
            <span className="font-semibold">Rate limiting for the public API</span>
            <span className="ml-2 flex gap-[2px] max-[880px]:hidden">
              <span className="rounded-[4px] bg-chip px-2 py-1">Document</span>
              <span className="px-2 py-1 text-faint">Diagrams</span>
              <span className="px-2 py-1 text-faint">Raw</span>
            </span>
            <span className="grow" />
            <span className="flex h-[30px] min-w-[168px] items-center gap-2 rounded-[4px] border border-line2 px-2 text-faint max-[880px]:hidden">
              Jump to...
              <span className="grow" />
              <kbd className="font-mono text-[11px]">⌘K</kbd>
            </span>
            <span className={BADGE}>5</span>
          </div>
          <div className="h-[2px] bg-elev">
            <div className="h-[2px] w-[46%] bg-accent" />
          </div>

          <div className="flex flex-wrap">
            <div className="flex w-[215px] flex-col gap-1 border-r border-line px-3 py-4 text-[13px] max-[880px]:hidden">
              <span className="mb-1 flex items-center gap-[6px] font-mono text-[11px] text-faint">
                OUTLINE
                <span className={BADGE}>1</span>
              </span>
              <span className="px-2 py-[5px] text-sub">
                <span className={`${OUTLINE_NO} text-faint`}>01</span> Overview
              </span>
              <span className="rounded-[4px] bg-chip px-2 py-[5px]">
                <span className={`${OUTLINE_NO} text-accent-text`}>02</span> Token bucket{' '}
                <span className="ml-1 inline-block h-[6px] w-[6px] rounded-full bg-[var(--c-warn-fill)]" />
              </span>
              <span className="px-2 py-[5px] text-sub">
                <span className={`${OUTLINE_NO} text-faint`}>03</span> Options
              </span>
              <span className="px-2 py-[5px] text-sub">
                <span className={`${OUTLINE_NO} text-faint`}>04</span> Risks
              </span>
            </div>

            <div className="flex min-w-0 flex-[1_1_468px] flex-col gap-[14px] px-6 py-5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[12px] text-accent-text">02</span>
                <span className="text-[20px] font-semibold">How the token bucket works</span>
              </div>
              <p className={`m-0 text-[15px] leading-[26px] ${PREVIEW_TEXT}`}>
                Every request takes a token from the{' '}
                <span className="relative border-b border-dashed border-info">
                  token bucket
                  <span className="absolute top-[calc(100%+8px)] left-0 z-[2] w-[272px] rounded-[6px] border border-line2 bg-elev px-[10px] py-2 text-[12px] leading-[18px] text-sub shadow-[var(--shadow-toast)]">
                    <b className="text-text">token bucket</b> refills at a fixed rate; each request takes one token, and an
                    empty bucket means the request is limited.
                  </span>
                </span>{' '}
                before it reaches the origin{' '}
                <span className={`inline-flex h-[18px] w-[18px] align-middle ${BADGE_LOOK}`}>2</span>
              </p>
              <div className="h-10" />
              <section className="rounded-[6px] border border-line bg-card">
                <div className="flex items-center gap-2 border-b border-line px-[10px] py-[6px] font-mono text-[11px] text-faint">
                  <span className="rounded-[3px] border border-line2 px-[5px] py-px">seq</span>
                  <span className="grow">step 2 of 3</span>
                  <span className={BADGE}>3</span>
                </div>
                <div className="overflow-x-auto py-2">
                  <div className="relative mx-auto h-[176px] w-[520px] text-[12px]">
                    <div className={`${NODE} left-5 border-line2 bg-elev`}>Client</div>
                    <div className={`${NODE} left-[200px] border-line2 bg-elev`}>Edge</div>
                    <div className={`${NODE} left-[380px] border-accent-line bg-accent-soft`}>Limiter</div>
                    <div className={`${LIFELINE} left-20`} />
                    <div className={`${LIFELINE} left-[260px]`} />
                    <div className={`${LIFELINE} left-[440px]`} />
                    <Arrow id="lp-arrow-1" left={80} top={68} color="var(--c-faint)" />
                    <Arrow id="lp-arrow-2" left={260} top={106} color="var(--c-accent-line)" />
                    <Arrow id="lp-arrow-3" left={261} top={146} color="var(--c-line2)" dashed back />
                    <div className={`${MESSAGE} top-[50px] left-[90px] text-sub`}>GET /orders</div>
                    <div className={`${MESSAGE} top-[88px] left-[270px] text-accent-text`}>take(key)</div>
                    <div className={`${MESSAGE} top-[128px] left-[270px] text-faint`}>ok, 41 left</div>
                  </div>
                </div>
              </section>
            </div>

            <div className="flex max-w-[373px] flex-[1_1_313px] flex-col gap-2 border-l border-line p-4 text-[13px]">
              <div className="flex items-center gap-[6px] font-mono text-[11px] text-faint">
                DECISIONS 2 / 4
                <span className="grow" />
                <span className={BADGE}>4</span>
              </div>
              <div className="flex gap-[3px]">
                <span className="h-1 flex-1 rounded-[2px] bg-accent" />
                <span className="h-1 flex-1 rounded-[2px] bg-[var(--c-warn-fill)]" />
                <span className="h-1 flex-1 rounded-[2px] bg-line" />
                <span className="h-1 flex-1 rounded-[2px] bg-line" />
              </div>
              <div className="flex items-baseline gap-[6px]">
                <span className="font-mono text-[11px] text-accent-text">D2</span>
                <span className="font-semibold">Requests per minute per key</span>
              </div>
              <span className="self-start rounded-[3px] border border-info-line bg-info-soft px-[6px] py-[2px] text-[12px] text-info">
                §02 Token bucket
              </span>
              <span className={`${OPTION} border-line text-sub`}>
                <kbd className={`${KBD} h-[18px] w-[18px] border border-line2`}>1</kbd>60 / min
              </span>
              <span className={`${OPTION} border-accent-line bg-accent-soft`}>
                <kbd className={`${KBD} h-4 w-4 bg-accent text-on-accent`}>2</kbd>600 / min
              </span>
              <span className={`${OPTION} border-line text-sub`}>
                <kbd className={`${KBD} h-[18px] w-[18px] border border-line2`}>3</kbd>Other, type your own
              </span>
              <span className="flex min-h-[34px] items-center rounded-[4px] border border-line2 px-2 text-faint">
                Reason / extra context (optional)
              </span>
              <span className="flex min-h-[34px] items-center justify-center rounded-[4px] bg-text font-semibold text-card [[data-theme=dark]_&]:text-page">
                Copy prompt
              </span>
            </div>
          </div>
        </div>

        <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4 p-0">
          {PREVIEW_CALLOUTS.map((callout, i) => (
            <li key={callout.term} className="flex gap-[10px]">
              <span className={`flex h-5 w-5 ${BADGE_LOOK}`}>{i + 1}</span>
              <span className="text-[14px] leading-[21px] text-sub">
                <b className="text-text">{callout.term}</b> {callout.text}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
