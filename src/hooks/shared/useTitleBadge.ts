import { useEffect, useRef } from 'react';
import { useNavigationBadges } from '@/hooks/ui/useNavigationBadges';

/**
 * Hook global qui préfixe le titre de l'onglet avec le nombre de non-lus.
 * Ex: "(5) Dashboard | OpenPulse"
 * Monté une seule fois dans le layout racine.
 */
export function useTitleBadge() {
  const { total } = useNavigationBadges();
  const observerRef = useRef<MutationObserver | null>(null);
  const totalRef = useRef(total);
  totalRef.current = total;

  useEffect(() => {
    const titleEl = document.querySelector('title');
    if (!titleEl) return;

    const prefixTitle = () => {
      const raw = document.title.replace(/^\(\d+\)\s*/, '');
      document.title = totalRef.current > 0 ? `(${totalRef.current}) ${raw}` : raw;
    };

    // Apply immediately
    prefixTitle();

    // Observe title changes from usePageTitle and re-apply prefix
    observerRef.current = new MutationObserver(() => {
      // Disconnect briefly to avoid infinite loop
      observerRef.current?.disconnect();
      prefixTitle();
      observerRef.current?.observe(titleEl, { childList: true, characterData: true, subtree: true });
    });

    observerRef.current.observe(titleEl, { childList: true, characterData: true, subtree: true });

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // Re-apply when total changes
  useEffect(() => {
    const raw = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = total > 0 ? `(${total}) ${raw}` : raw;
  }, [total]);
}
