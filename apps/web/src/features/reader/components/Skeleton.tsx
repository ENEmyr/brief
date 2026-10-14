const OUTLINE_ROWS = ['w-[60%]', 'w-[86%]', 'w-[72%]', 'w-[80%]', 'w-[64%]']

/** The loading state (B-States:33-40). */
export function Skeleton() {
  return (
    <div role="status" aria-label="Loading session" className="sk-delay flex min-h-screen flex-col bg-page">
      <div className="flex h-[53px] shrink-0 items-center gap-3 border-b border-line bg-card px-4">
        <span className="size-[18px] shrink-0 rounded-ctrl bg-accent" />
        <span className="sk h-3 w-[220px] min-w-0" />
        <span className="grow" />
        <span className="sk h-7 w-[260px] max-[880px]:hidden" />
        <span className="sk h-7 w-24 max-[880px]:hidden" />
      </div>
      <div className="grid grow grid-cols-[236px_minmax(0,1fr)_340px] max-[1101px]:grid-cols-[236px_minmax(0,1fr)] max-[880px]:grid-cols-[minmax(0,1fr)]">
        <div className="flex flex-col gap-3 border-r border-line px-4 py-5 max-[880px]:hidden">
          {OUTLINE_ROWS.map((width) => (
            <span key={width} className={`sk h-[10px] ${width}`} />
          ))}
        </div>
        <div className="flex flex-col gap-3 px-10 py-7 max-[880px]:px-3 max-[880px]:py-[14px]">
          <span className="sk h-[22px] w-[46%]" />
          <span className="sk h-[10px] w-[30%]" />
          <span className="h-[6px]" />
          <span className="sk h-3 w-full" />
          <span className="sk h-3 w-[96%]" />
          <span className="sk h-3 w-[88%]" />
          <span className="sk h-[150px] w-full rounded-panel" />
        </div>
        <div className="flex flex-col gap-[10px] border-l border-line px-4 py-5 max-[1101px]:hidden">
          <span className="sk h-[6px] w-full" />
          <span className="sk h-[14px] w-[70%]" />
          <span className="sk h-9 w-full" />
          <span className="sk h-9 w-full" />
          <span className="sk h-9 w-full" />
          <span className="sk h-[34px] w-full" />
        </div>
      </div>
    </div>
  )
}
