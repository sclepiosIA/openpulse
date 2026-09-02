import { Skeleton } from '@/components/ui/skeleton';

export function PublicPageSkeleton() {
  return (
    <div className="min-h-dvh bg-background">
      {/* Header skeleton */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>

      {/* Hero section skeleton */}
      <div className="container mx-auto px-4 py-12 space-y-8">
        <div className="text-center space-y-4">
          <Skeleton className="h-12 w-3/4 mx-auto" />
          <Skeleton className="h-6 w-1/2 mx-auto" />
        </div>

        {/* Content cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={`public-page-card-skeleton-${i}`} className="space-y-4 p-6 border rounded-lg">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-10 w-full mt-4" />
            </div>
          ))}
        </div>

        {/* Video grid skeleton */}
        <div className="mt-16 space-y-6">
          <Skeleton className="h-8 w-64 mx-auto" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={`public-page-video-skeleton-${i}`} className="space-y-3">
                <Skeleton className="h-48 w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
