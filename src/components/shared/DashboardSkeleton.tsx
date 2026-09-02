import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DashboardSkeletonProps {
  className?: string;
  variant?: 'widget' | 'list' | 'stats';
}

/**
 * Unified dashboard loading skeleton
 * Used in Suspense fallbacks to prevent layout shift
 */
export function DashboardSkeleton({ className, variant = 'widget' }: DashboardSkeletonProps) {
  if (variant === 'stats') {
    return (
      <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-3", className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={`dashboard-skeleton-stats-${i}`} className="overflow-hidden">
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`dashboard-skeleton-list-${i}`} className="flex items-center gap-3 p-2">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Default: widget skeleton
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-4 rounded" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-2.5 w-2/3" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Inline text skeleton for Suspense fallbacks
 */
export function InlineSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 flex items-center gap-2", className)}>
      <Skeleton className="h-4 w-4 rounded animate-pulse" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}
