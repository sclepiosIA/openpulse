import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loader pour EmailListItem
 * Affiche un placeholder pendant le chargement des emails
 */
export function EmailListItemSkeleton() {
  return (
    <div 
      className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_auto_auto_minmax(140px,200px)_1fr_minmax(80px,120px)] md:grid-cols-[auto_auto_auto_minmax(140px,200px)_minmax(200px,280px)_1fr_minmax(100px,140px)] gap-2 sm:gap-3 md:gap-4 px-3 sm:px-4 py-3 border-b min-h-[88px]"
      role="status"
      aria-label="Chargement de l'email..."
    >
      {/* Checkbox */}
      <Skeleton className="h-5 w-5 rounded" />
      
      {/* Star - Hidden on mobile */}
      <Skeleton className="hidden sm:block h-4 w-4 rounded" />
      
      {/* Email Icon - Hidden on mobile */}
      <Skeleton className="hidden sm:block h-5 w-5 rounded" />
      
      {/* Sender */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-24" />
      </div>
      
      {/* Subject + Preview */}
      <div className="space-y-2 min-w-0 col-span-2 sm:col-span-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      
      {/* Badges - Hidden on mobile */}
      <div className="hidden md:flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      
      {/* Date/Time */}
      <div className="flex items-center justify-end">
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

/**
 * Liste de plusieurs skeleton loaders
 */
interface EmailListSkeletonProps {
  count?: number;
}

export function EmailListSkeleton({ count = 10 }: EmailListSkeletonProps) {
  return (
    <div role="status" aria-live="polite" aria-label="Chargement des emails...">
      {Array.from({ length: count }).map((_, i) => (
        <EmailListItemSkeleton key={`email-list-item-skeleton-${i}`} />
      ))}
      <span className="sr-only">Chargement des emails...</span>
    </div>
  );
}
