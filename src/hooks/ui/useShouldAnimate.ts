import { useState, useEffect } from 'react';
import { useMediaQuery } from '../shared/useMediaQuery';

/**
 * Hook to determine if animations should run.
 * Returns false (disable animations) when:
 * - User prefers reduced motion
 * - Document is hidden (tab inactive)
 * - Device is mobile (< 768px)
 * 
 * This helps save CPU/battery on mobile and when the page is not visible.
 */
export function useShouldAnimate(): boolean {
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    // Skip in SSR
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === 'visible');
    };

    // Set initial state
    setIsDocumentVisible(document.visibilityState === 'visible');

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Disable animations if:
  // - User prefers reduced motion
  // - Tab is not visible
  // - Device is mobile (battery/CPU optimization)
  if (prefersReducedMotion) return false;
  if (!isDocumentVisible) return false;
  if (isMobile) return false;

  return true;
}

/**
 * Lighter version that only checks visibility and reduced motion.
 * Allows animations on mobile but pauses when tab is hidden.
 */
export function useShouldAnimateLight(): boolean {
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === 'visible');
    };

    setIsDocumentVisible(document.visibilityState === 'visible');

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (prefersReducedMotion) return false;
  if (!isDocumentVisible) return false;

  return true;
}
