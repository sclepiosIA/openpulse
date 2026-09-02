import { useEffect } from 'react';

const DEFAULT_TITLE = 'OpenPulse';

/**
 * Hook réutilisable pour définir le titre de la page.
 * Restaure le titre par défaut au démontage.
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | ${DEFAULT_TITLE}`;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
}
