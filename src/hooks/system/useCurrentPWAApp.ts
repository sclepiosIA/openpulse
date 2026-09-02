import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Types d'applications PWA supportées
 */
export type PWAAppType = 'mail' | 'pulse' | 'todos' | 'calendar' | 'jarvis' | 'main' | null;

/**
 * Configuration des routes PWA
 */
const PWA_ROUTES: Record<string, PWAAppType> = {
  '/m/mail': 'mail',
  '/m/pulse': 'pulse',
  '/m/todos': 'todos',
  '/m/calendrier': 'calendar',
  '/m/jarvis': 'jarvis',
  '/emails': 'mail',
  '/pulse': 'pulse',
  '/todos': 'todos',
  '/calendrier': 'calendar',
};

/**
 * Hook pour détecter quelle application PWA est actuellement active
 * basé sur la route courante.
 * 
 * @returns L'identifiant de l'app PWA active ('mail', 'pulse', 'todos', 'calendar')
 *          ou 'main' si on est sur l'app principale, ou null si indéterminé
 */
export function useCurrentPWAApp(): PWAAppType {
  const location = useLocation();

  return useMemo(() => {
    const pathname = location.pathname;
    
    // Vérifier les routes PWA mobiles et desktop
    for (const [route, appType] of Object.entries(PWA_ROUTES)) {
      if (pathname.startsWith(route)) {
        return appType;
      }
    }
    
    // Si on est sur une route authentifiée mais pas une app spécifique
    if (pathname !== '/auth' && pathname !== '/') {
      return 'main';
    }
    
    return 'main';
  }, [location.pathname]);
}
