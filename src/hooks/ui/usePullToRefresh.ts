import { useState, useRef, useCallback, TouchEvent } from 'react';
import { debug } from '@/lib/debug';

export interface UsePullToRefreshProps {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 150,
}: UsePullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canPull, setCanPull] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Only allow pull to refresh at top of scroll
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      currentY.current = startY.current;
      setCanPull(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!canPull || isRefreshing) return;
    
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    if (diff > 0) {
      // Prevent default scroll while pulling
      e.preventDefault();
      
      // Apply resistance as user pulls further
      const resistance = Math.min(diff / 2, maxPull);
      setPullDistance(resistance);
    }
  }, [canPull, isRefreshing, maxPull]);

  const handleTouchEnd = useCallback(async () => {
    if (!canPull || isRefreshing) return;
    
    const diff = currentY.current - startY.current;
    
    if (diff > threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold); // Lock at threshold during refresh
      
      try {
        await onRefresh();
      } catch (error) {
        debug.error('Pull to refresh error:', error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
    
    setCanPull(false);
  }, [canPull, isRefreshing, threshold, onRefresh]);

  const progress = Math.min(pullDistance / threshold, 1);
  const shouldRefresh = pullDistance >= threshold;

  return {
    pullDistance,
    isRefreshing,
    progress,
    shouldRefresh,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}
