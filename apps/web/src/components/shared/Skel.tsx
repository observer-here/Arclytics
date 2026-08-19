export function Skel({ className = "" }: { className?: string }) {
  return <div className={`skel ${className}`} />;
}

export function ChartSkel({
  title,
  kind = "bar",
}: {
  title: string;
  kind?: "area" | "bar";
}) {
  const bars = [42, 58, 36, 72, 51, 84, 47, 63, 76, 40, 88, 54, 69, 45, 81, 57, 34, 74, 49, 86, 43, 66, 78, 52];
  return (
    <div className="card min-w-0 overflow-hidden p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="panel-title">{title}</div>
        <div className="flex gap-0.5">
          {[0, 1, 2, 3].map((i) => (
            <Skel key={i} className="h-4 w-6" />
          ))}
        </div>
      </div>
      <div className="mb-1 flex items-baseline gap-2">
        <Skel className="h-5 w-16" />
        <Skel className="h-3 w-10" />
      </div>
      <div className="flex gap-1">
        <div className="flex h-[110px] w-9 shrink-0 flex-col justify-between py-1">
          <Skel className="h-2 w-full" />
          <Skel className="h-2 w-3/4 ml-auto" />
          <Skel className="h-2 w-1/2 ml-auto" />
        </div>
        <div className="h-[110px] min-w-0 flex-1">
          {kind === "area" ? (
            <div
              className="skel h-full w-full"
              style={{
                clipPath:
                  "polygon(0% 62%, 8% 47%, 17% 55%, 25% 35%, 33% 44%, 42% 25%, 50% 38%, 58% 20%, 67% 33%, 75% 16%, 83% 29%, 92% 22%, 100% 36%, 100% 100%, 0% 100%)",
              }}
            />
          ) : (
            <div className="flex h-full items-end gap-px">
              {bars.map((h, i) => (
                <div key={i} className="skel min-w-0 flex-1 rounded-t-[2px]" style={{ height: `${h}%` }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PageNavSkel() {
  return (
    <div className="flex items-center justify-center gap-3 px-1 pt-2">
      <Skel className="h-8 w-[4.5rem] rounded-md" />
      <Skel className="h-4 w-28" />
      <Skel className="h-8 w-16 rounded-md" />
    </div>
  );
}

export function TableSkel({ title, rows = 8 }: { title: string; rows?: number }) {
  return (
    <div className="card p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="panel-title">{title}</div>
        <Skel className="h-3 w-12" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skel className="h-5 w-5 shrink-0 rounded" />
            <Skel className="h-4 flex-1" />
            <Skel className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
