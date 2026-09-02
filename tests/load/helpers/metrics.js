/**
 * k6 Metrics Helper — Métriques composites par niveau de criticité SLO
 *
 * Permet d'enregistrer les latences par groupe fonctionnel
 * et d'appliquer des thresholds différenciés dans le full scenario.
 */
import { Trend } from 'k6/metrics';

// ── Trends par niveau de criticité ──────────────────────
export const criticalLatency = new Trend('latency_critical', true);
export const highLatency     = new Trend('latency_high', true);
export const standardLatency = new Trend('latency_standard', true);
export const lowLatency      = new Trend('latency_low', true);

/**
 * Retourne les thresholds composites pour le full scenario.
 */
export function getCompositeThresholds() {
  return {
    http_req_duration:  ['p(95)<1500', 'p(99)<3000'],
    http_req_failed:    ['rate<0.01'],
    checks:             ['rate>0.95'],
    latency_critical:   ['p(95)<500',  'p(99)<1000'],
    latency_high:       ['p(95)<800',  'p(99)<1500'],
    latency_standard:   ['p(95)<1200', 'p(99)<2500'],
    latency_low:        ['p(95)<2000', 'p(99)<4000'],
  };
}

/**
 * Mapping module → métrique Trend correspondante.
 */
const MODULE_METRIC = {
  urgences: criticalLatency,
  reanimation: criticalLatency,
  'monitoring-realtime': criticalLatency,
  pediatrie: criticalLatency,
  obstetrique: criticalLatency,
  'bloc-operatoire': criticalLatency,
  'samu-smur': criticalLatency,
  telesurveillance: criticalLatency,

  pharmacie: highLatency,
  prescriptions: highLatency,
  labo: highLatency,
  imagerie: highLatency,
  psychiatrie: highLatency,
  'soins-infirmiers': highLatency,
  lits: highLatency,
  ehpad: highLatency,
  had: highLatency,
  brancardage: highLatency,

  consultations: standardLatency,
  hospitalisation: standardLatency,
  facturation: standardLatency,
  pmsi: standardLatency,
  telemedecine: standardLatency,
  rh: standardLatency,
  audit: standardLatency,
  logistique: standardLatency,

  ged: lowLatency,
  qualite: lowLatency,
  fleet: lowLatency,
  'carbon-footprint': lowLatency,
  pedagogie: lowLatency,
};

/**
 * Enregistre une latence sur la métrique du bon niveau pour un module donné.
 * @param {string} moduleName — nom du module
 * @param {number} durationMs — latence en ms
 */
export function recordModuleLatency(moduleName, durationMs) {
  const metric = MODULE_METRIC[moduleName] || standardLatency;
  metric.add(durationMs);
}
