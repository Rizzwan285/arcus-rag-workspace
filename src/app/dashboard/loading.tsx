export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div>
        <div className="h-8 w-48 rounded-lg bg-surface-200"></div>
        <div className="mt-2 h-4 w-72 rounded-lg bg-surface-100"></div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-surface-200 bg-white p-6"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-20 rounded bg-surface-100"></div>
                <div className="h-8 w-12 rounded bg-surface-200"></div>
              </div>
              <div className="h-12 w-12 rounded-xl bg-surface-100"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-32 rounded bg-surface-200"></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-surface-200 bg-white p-6"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-surface-100"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 rounded bg-surface-200"></div>
                  <div className="h-3 w-36 rounded bg-surface-100"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Large Card Skeleton */}
      <div className="rounded-2xl border border-surface-200 bg-white p-8">
        <div className="space-y-4">
          <div className="h-5 w-40 rounded bg-surface-200"></div>
          <div className="h-3 w-64 rounded bg-surface-100"></div>
          <div className="mt-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-xl bg-surface-50 p-4"
              >
                <div className="h-8 w-8 rounded-full bg-surface-200"></div>
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-48 rounded bg-surface-200"></div>
                  <div className="h-3 w-64 rounded bg-surface-100"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
