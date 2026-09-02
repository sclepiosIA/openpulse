import { Skeleton } from "@/components/ui/skeleton";

interface SidebarMenuSkeletonProps {
  itemCount?: number;
  showGroupLabels?: boolean;
  groupCount?: number;
}

export function SidebarMenuSkeleton({ 
  itemCount = 4, 
  showGroupLabels = true,
  groupCount = 3 
}: SidebarMenuSkeletonProps) {
  return (
    <div className="py-2 space-y-4">
      {Array.from({ length: groupCount }).map((_, groupIndex) => (
        <div key={groupIndex} className="space-y-2">
          {showGroupLabels && (
            <div className="px-4">
              <Skeleton className="h-3 w-20" />
            </div>
          )}
          <div className="space-y-1 px-2">
            {Array.from({ length: itemCount }).map((_, itemIndex) => (
              <div 
                key={itemIndex} 
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 flex-1 max-w-[120px]" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SidebarMenuSkeletonCollapsed({ itemCount = 12 }: { itemCount?: number }) {
  return (
    <div className="py-2 space-y-1">
      {Array.from({ length: itemCount }).map((_, index) => (
        <div key={`skeleton-collapsed-${index}`} className="flex justify-center py-2.5">
          <Skeleton className="h-5 w-5 rounded" />
        </div>
      ))}
    </div>
  );
}
