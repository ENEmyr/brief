const BARS = [34, 52, 41, 78, 96]

/**
 * A still of a Brief document, built from the same tokens the reader uses.
 *
 * It is not the reader's components: those pull echarts, shiki, katex, and
 * mermaid, which the reader loads lazily on purpose, and none of them belong in
 * the first load of the landing page. It is not a screenshot either, because a
 * screenshot goes stale the next time the reader changes and cannot follow the
 * theme. It is one `role="img"` with a single label, so assistive tech gets a
 * description instead of a fake document with unreachable controls.
 */
export function DocumentPreview() {
  return (
    <div
      role="img"
      aria-label="A Brief document showing a numbered section, a paragraph, a note callout, a bar chart, a code block, and a decision card with two options where the second is selected."
      className="overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]"
    >
      <div className="flex items-center gap-2 border-b border-line2 bg-elev px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-surface1" />
        <span className="h-2.5 w-2.5 rounded-full bg-surface1" />
        <span className="ml-2 font-mono text-[11px] text-faint">brief.algoryth.me/s/k2p9x4</span>
      </div>

      <div className="p-5">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[13px] font-semibold text-mauve">2.</span>
          <h3 className="text-[17px] font-semibold tracking-tight text-text">Rate limiting</h3>
        </div>

        <p className="mt-3 text-[13.5px] leading-relaxed text-sub">
          Session creation doubled in Q3, and the endpoint has no ceiling.{' '}
          <mark className="rounded-sm bg-[var(--ctp-mark)] px-0.5 text-[var(--ctp-marktx)]">
            The binding is the cheaper path
          </mark>{' '}
          if we accept per-colo counting.
        </p>

        <div className="mt-4 rounded-lg border-l-[3px] border-blue bg-[var(--callout-note-bg)] px-3 py-2 text-[12.5px] leading-relaxed text-text">
          KV counters are eventually consistent. Bursts can overshoot the limit.
        </div>

        <div className="mt-4 rounded-lg border border-line bg-elev p-3">
          <p className="font-mono text-[10px] tracking-wide text-faint uppercase">
            Sessions per hour
          </p>
          <svg
            viewBox="0 0 400 88"
            preserveAspectRatio="none"
            className="mt-2 h-[88px] w-full"
            aria-hidden="true"
            focusable="false"
          >
            {BARS.map((value, index) => {
              const height = (value / 100) * 82
              return (
                <rect
                  key={value}
                  x={index * 78 + 12}
                  y={86 - height}
                  width={58}
                  height={height}
                  rx={2}
                  fill="var(--ctp-mauve)"
                  opacity={0.35 + index * 0.16}
                />
              )
            })}
            <line x1="0" y1="87" x2="400" y2="87" stroke="var(--ctp-line)" strokeWidth="2" />
          </svg>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg">
          <pre className="overflow-x-auto bg-[var(--code-bg)] px-3 py-2 font-mono text-[11.5px] leading-[1.6] text-[#cdd6f4]">
            <code>
              <span className="block">
                <span className="text-[#cba6f7]">await</span>
                <span>{' env.'}</span>
                <span className="text-[#89b4fa]">LIMITER</span>
                <span>{'.limit({ key: ip })'}</span>
              </span>
            </code>
          </pre>
        </div>

        <div className="mt-5 rounded-xl border border-mauve/40 bg-mauvesoft p-4">
          <p className="font-mono text-[10px] tracking-wide text-mauve uppercase">Decision</p>
          <p className="mt-1.5 text-[14px] font-semibold text-text">
            Which rate limiter should we use?
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <span className="flex items-center gap-2.5 rounded-lg border border-line bg-card px-3 py-2 text-[13px] text-sub">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-surface2" />
              <span>Cloudflare Rate Limiting binding</span>
            </span>
            <span className="flex items-center gap-2.5 rounded-lg border border-mauve bg-card px-3 py-2 text-[13px] font-medium text-text">
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-mauve">
                <span className="h-1.5 w-1.5 rounded-full bg-mauve" />
              </span>
              <span>Custom KV counter</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
