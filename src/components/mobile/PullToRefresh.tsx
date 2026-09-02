import React from 'react';
import { usePullToRefresh } from '@/hooks/ui/usePullToRefresh';
import { RefreshCw, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
  className?: string;
}

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 60,
  className,
}: PullToRefreshProps) {
  const { pullDistance, isRefreshing, progress, shouldRefresh, handlers } = usePullToRefresh({
    onRefresh,
    threshold,
    maxPull: 100,
  });

  return (
    <div className={cn('relative overflow-hidden', className)} {...handlers}>
      {/* Indicateur de pull - Plus compact */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center transition-opacity duration-150 z-40 pointer-events-none"
        style={{
          top: Math.max(0, pullDistance - 40),
          opacity: Math.min(progress * 1.5, 1),
        }}
      >
        <div className={cn(
          "rounded-full p-1.5 shadow-md transition-colors duration-200",
          shouldRefresh || isRefreshing ? "bg-primary" : "bg-muted"
        )}>
          {isRefreshing ? (
            <RefreshCw className="h-4 w-4 animate-spin text-primary-foreground" />
          ) : (
            <ArrowDown 
              className={cn(
                "h-4 w-4 transition-all duration-200",
                shouldRefresh ? "text-primary-foreground" : "text-muted-foreground"
              )}
              style={{
                transform: `rotate(${shouldRefresh ? 180 : 0}deg)`,
              }}
            />
          )}
        </div>
      </div>

      {/* Contenu - Translation réduite */}
      <div
        style={{
          transform: `translateY(${Math.min(pullDistance * 0.5, 30)}px)`,
          transition: isRefreshing ? 'transform 200ms ease-out' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
