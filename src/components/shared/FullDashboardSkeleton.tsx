import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Full-page dashboard skeleton shown during initial load.
 * Mirrors the actual layout: Hero + KPI row + widget grid.
 */
export function FullDashboardSkeleton() {
  return (
    <div className="min-h-dvh animate-fade-in">
      {/* Hero skeleton */}
      <div className="w-full h-[180px] sm:h-[200px] bg-gradient-to-r from-muted/60 to-muted/40 rounded-b-2xl px-4 sm:px-8 pt-8 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-4 pt-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>

      {/* KPI row */}
      <div className="px-2 sm:px-4 lg:px-6 xl:px-8 -mt-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={`full-dashboard-kpi-skeleton-${i}`} className="overflow-hidden">
              <CardContent className="p-3 sm:p-4 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-2 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Widget grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={`full-dashboard-widget-skeleton-${i}`} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-4 rounded" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={`full-dashboard-widget-${i}-row-${j}`} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-2.5 w-1/2" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
