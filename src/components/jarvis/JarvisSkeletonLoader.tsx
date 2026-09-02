/**
 * JarvisSkeletonLoader - États de chargement premium
 * 
 * Affiche des skeletons animés pendant le chargement initial
 * et les transitions pour une UX fluide
 */

import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface JarvisSkeletonLoaderProps {
  variant?: 'message' | 'panel' | 'actions' | 'stats';
  className?: string;
}

export function JarvisSkeletonLoader({ 
  variant = 'message',
  className 
}: JarvisSkeletonLoaderProps) {
  if (variant === 'message') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn("space-y-3 p-4", className)}
      >
        <div className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </motion.div>
    );
  }

  if (variant === 'panel') {
    return (
      <div className={cn("space-y-4 p-4", className)}>
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        
        {/* Quick actions skeleton */}
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={`skeleton-action-${i}`} className="h-8 w-24 rounded-lg" />
          ))}
        </div>

        {/* Messages skeleton */}
        {[1, 2, 3].map(i => (
          <div key={`skeleton-msg-${i}`} className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" style={{ width: `${70 + i * 10}%` }} />
              <Skeleton className="h-4" style={{ width: `${50 + i * 5}%` }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'actions') {
    return (
      <div className={cn("space-y-3 p-4", className)}>
        {[1, 2, 3].map(i => (
          <motion.div
            key={`skeleton-actions-${i}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-4 rounded-xl border border-border/50"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  if (variant === 'stats') {
    return (
      <div className={cn("space-y-4 p-4", className)}>
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <motion.div
              key={`skeleton-kpi-${i}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="p-4 rounded-xl border border-border/50"
            >
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-2 w-12 mt-2" />
            </motion.div>
          ))}
        </div>
        
        {/* Chart skeleton */}
        <div className="p-4 rounded-xl border border-border/50">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return null;
}

// Specialized typing indicator with pulsing dots
export function JarvisTypingIndicator({ className }: { className?: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn("flex items-center gap-2 py-2", className)}
    >
      <div className="flex items-center gap-1 px-3 py-2 rounded-2xl bg-muted">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={`typing-dot-${i}`}
            className="w-2 h-2 rounded-full bg-primary/60"
            animate={{
              y: [0, -6, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">Jarvis tape...</span>
    </motion.div>
  );
}
