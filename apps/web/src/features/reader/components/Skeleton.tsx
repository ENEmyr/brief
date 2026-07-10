export function Skeleton() {
  return (
    <div className="min-h-screen" role="status" aria-label="Loading session">
      <div className="max-w-[1180px] mx-auto px-7 pt-5">
        <div className="flex justify-between mb-[26px]">
          <div className="sk w-[220px] h-[26px]" />
          <div className="sk w-[150px] h-[26px]" />
        </div>
        <div className="sk w-full h-[118px] mb-[26px]" />
        <div className="min-[880px]:grid min-[880px]:grid-cols-[172px_1fr] min-[880px]:gap-9">
          <div>
            <div className="sk h-4 w-full mb-3" />
            <div className="sk h-3.5 w-4/5 mb-[9px]" />
            <div className="sk h-3.5 w-[90%] mb-[9px]" />
            <div className="sk h-3.5 w-[70%]" />
          </div>
          <div>
            <div className="sk w-[46%] h-6 mb-[18px]" />
            <div className="sk h-3.5 w-full mb-2.5" />
            <div className="sk h-3.5 w-[97%] mb-2.5" />
            <div className="sk h-3.5 w-[88%] mb-[22px]" />
            <div className="sk w-full h-[200px] mb-[22px]" />
            <div className="sk h-3.5 w-full mb-2.5" />
            <div className="sk h-3.5 w-[92%]" />
          </div>
        </div>
      </div>
    </div>
  )
}
