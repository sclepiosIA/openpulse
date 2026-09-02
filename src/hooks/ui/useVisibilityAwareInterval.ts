import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook for running an interval that automatically pauses when the browser tab is hidden.
 * This prevents unnecessary background polling and saves resources.
 * 
 * @param callback - Function to call on each interval tick
 * @param delay - Interval delay in milliseconds (null to disable)
 * @param options - Additional options
 * @param options.runImmediately - Whether to run the callback immediately on mount (default: true)
 * @param options.enabled - Whether the interval is enabled (default: true)
 */
export function useVisibilityAwareInterval(
  callback: () => void | Promise<void>,
  delay: number | null,
  options: {
    runImmediately?: boolean;
    enabled?: boolean;
  } = {}
) {
  const { runImmediately = true, enabled = true } = options;
  
  // Store callback in ref to avoid recreating interval on callback changes
  const callbackRef = useRef(callback);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const startInterval = useCallback(() => {
    if (delay === null || !enabled || isRunningRef.current) return;
    
    isRunningRef.current = true;
    intervalRef.current = setInterval(() => {
      callbackRef.current();
    }, delay);
  }, [delay, enabled]);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isRunningRef.current = false;
  }, []);

  useEffect(() => {
    if (!enabled || delay === null) {
      stopInterval();
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopInterval();
      } else {
        // Just restart interval — React Query handles refetch on reconnect
        startInterval();
      }
    };

    // Initial run
    if (runImmediately && !document.hidden) {
      callbackRef.current();
    }

    // Start interval if tab is visible
    if (!document.hidden) {
      startInterval();
    }

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopInterval();
    };
  }, [delay, enabled, runImmediately, startInterval, stopInterval]);

  // Manual control methods
  return {
    start: startInterval,
    stop: stopInterval,
    isRunning: () => isRunningRef.current,
  };
}
