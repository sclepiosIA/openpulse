/**
 * useJarvisProactiveAlerts - Hook singleton pour alertes proactives JARVIS
 * 
 * Délègue au contexte singleton JarvisProactiveAlertsContext.
 * Un seul canal Realtime est partagé par tous les composants.
 */

import { useJarvisProactiveAlertsContext } from '@/contexts/JarvisProactiveAlertsContext';
export type { ProactiveAlert } from '@/contexts/JarvisProactiveAlertsContext';

export function useJarvisProactiveAlerts() {
  return useJarvisProactiveAlertsContext();
}
