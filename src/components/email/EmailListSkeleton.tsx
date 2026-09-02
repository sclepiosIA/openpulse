import { Skeleton } from "@/components/ui/skeleton";

interface EmailListSkeletonProps {
  count?: number;
}

/**
 * Skeleton loading pour la liste d'emails moderne
 * Correspond au layout de EmailListItemModern
 */
export function EmailListSkeleton({ count = 8 }: EmailListSkeletonProps) {
  return (
    <div className="divide-y divide-border">
      {[...Array(count)].map((_, i) => (
        <div
          key={`email-list-skeleton-${i}`}
          className="flex items-start gap-3 px-4 py-3 animate-in fade-in-50 duration-300"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          {/* Left: Checkbox + Avatar */}
          <div className="flex items-center gap-3 shrink-0">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>

          {/* Center: Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Row 1: Sender + Date */}
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-16" />
            </div>
            
            {/* Row 2: Subject */}
            <Skeleton className="h-4 w-3/4" />
            
            {/* Row 3: Preview */}
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            
            {/* Row 4: Badges */}
            <div className="flex items-center gap-2 pt-1">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
