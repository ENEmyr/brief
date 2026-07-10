const LINE_WIDTHS = ['w-2/3', 'w-1/3', 'w-full', 'w-5/6', 'w-4/6', 'w-1/2']

export function Skeleton() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-surface0 bg-base/90 px-4 backdrop-blur">
        <span className="font-semibold">Brief</span>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8 space-y-3">
          <div className="h-8 w-1/2 animate-pulse rounded bg-surface0" />
          <div className="h-4 w-1/4 animate-pulse rounded bg-surface0" />
        </div>
        <div className="space-y-4">
          {LINE_WIDTHS.map((width, i) => (
            <div key={i} className={`h-4 ${width} animate-pulse rounded bg-surface0`} />
          ))}
        </div>
      </main>
    </div>
  )
}
