/**
 * k6 Chaos Helper — Injection d'erreurs pour tests de résilience
 *
 * Simule des conditions dégradées :
 * - Délais aléatoires (réseau lent)
 * - Réponses en timeout
 * - Erreurs intermittentes
 *
 * Utilisé par les tests chaos engineering pour vérifier la dégradation gracieuse.
 */
import { sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// ── Métriques chaos ────────────────────────────────────
export const chaosInjections = new Counter('chaos_injections_total');
export const chaosDelayMs = new Trend('chaos_delay_ms', true);
export const chaosFallbacks = new Counter('chaos_fallbacks_triggered');

/**
 * Profils de chaos configurables
 */
export const CHAOS_PROFILES = {
  /** Réseau dégradé : délais aléatoires 200-2000ms */
  network_degraded: {
    label: 'Réseau dégradé',
    delayRange: [200, 2000],
    errorRate: 0.05,
    timeoutRate: 0.02,
  },
  /** Edge Functions lentes : simule surcharge backend */
  edge_slow: {
    label: 'Edge Functions lentes',
    delayRange: [1000, 5000],
    errorRate: 0.10,
    timeoutRate: 0.05,
  },
  /** Partition partielle : erreurs intermittentes hautes */
  partition: {
    label: 'Partition réseau partielle',
    delayRange: [500, 3000],
    errorRate: 0.20,
    timeoutRate: 0.10,
  },
  /** Nominal dégradé : conditions réalistes de pic */
  peak_degraded: {
    label: 'Pic de charge dégradé',
    delayRange: [100, 800],
    errorRate: 0.03,
    timeoutRate: 0.01,
  },
};

/**
 * Injecte un délai aléatoire selon le profil chaos.
 * @param {string} profileName — nom du profil chaos
 * @returns {boolean} true si l'injection a eu lieu
 */
export function injectDelay(profileName = 'network_degraded') {
  const profile = CHAOS_PROFILES[profileName] || CHAOS_PROFILES.network_degraded;

  if (Math.random() < 0.3) { // 30% chance d'injection
    const [min, max] = profile.delayRange;
    const delay = min + Math.random() * (max - min);
    chaosDelayMs.add(delay);
    chaosInjections.add(1);
    sleep(delay / 1000);
    return true;
  }
  return false;
}

/**
 * Simule une erreur aléatoire selon le profil.
 * @param {string} profileName — nom du profil chaos
 * @returns {'ok'|'error'|'timeout'} résultat simulé
 */
export function simulateError(profileName = 'network_degraded') {
  const profile = CHAOS_PROFILES[profileName] || CHAOS_PROFILES.network_degraded;
  const rand = Math.random();

  if (rand < profile.timeoutRate) {
    chaosInjections.add(1);
    return 'timeout';
  }
  if (rand < profile.timeoutRate + profile.errorRate) {
    chaosInjections.add(1);
    return 'error';
  }
  return 'ok';
}

/**
 * Wrapper qui exécute une fonction avec injection de chaos.
 * En cas d'erreur simulée, appelle le fallback.
 * @param {Function} mainFn — fonction principale
 * @param {Function} fallbackFn — fonction de fallback
 * @param {string} profileName — profil chaos
 * @returns {*} résultat de mainFn ou fallbackFn
 */
export function withChaos(mainFn, fallbackFn, profileName = 'network_degraded') {
  injectDelay(profileName);

  const errorType = simulateError(profileName);
  if (errorType === 'timeout' || errorType === 'error') {
    chaosFallbacks.add(1);
    if (fallbackFn) return fallbackFn(errorType);
    return null;
  }

  return mainFn();
}

/**
 * Vérifie qu'un système se dégrade gracieusement.
 * Retourne un objet de métriques pour vérification.
 */
export function getChaosMetrics() {
  return {
    injections: chaosInjections,
    delays: chaosDelayMs,
    fallbacks: chaosFallbacks,
  };
}
