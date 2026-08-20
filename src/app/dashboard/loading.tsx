import { Skeleton } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-line pb-5">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="mt-2.5 h-7 w-56" />
        <Skeleton className="mt-2 h-3.5 w-80" />
      </div>

      {/* Metric strip */}
      <div className="panel grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="border-b border-line p-4 md:border-b-0">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="mt-2.5 h-7 w-14" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        <Skeleton className="h-2.5 w-24" />
        <div className="panel divide-y divide-line">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <Skeleton className="h-4 w-4 shrink-0 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-2.5 w-1/4" />
              </div>
              <Skeleton className="h-2.5 w-12 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
