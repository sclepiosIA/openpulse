/**
 * k6 SLO Matrix — Seuils différenciés par criticité module POINT Healthcare
 *
 * 4 niveaux de criticité avec mapping module → SLO.
 * Utilisé par les tests pour appliquer des thresholds adaptés au contexte métier.
 */

export const SLO_LEVELS = {
  CRITICAL: {
    label: 'Ultra-critique (vie patient)',
    p95: 500,
    p99: 1000,
    errorRate: 0.001,
    checksRate: 0.99,
  },
  HIGH: {
    label: 'Haute priorité clinique',
    p95: 800,
    p99: 1500,
    errorRate: 0.005,
    checksRate: 0.98,
  },
  STANDARD: {
    label: 'Standard métier',
    p95: 1200,
    p99: 2500,
    errorRate: 0.01,
    checksRate: 0.95,
  },
  LOW: {
    label: 'Basse priorité',
    p95: 2000,
    p99: 4000,
    errorRate: 0.02,
    checksRate: 0.93,
  },
};

/**
 * Mapping module → niveau de criticité
 */
export const MODULE_CRITICALITY = {
  // CRITICAL — impact direct sur la vie du patient
  'urgences':              'CRITICAL',
  'reanimation':           'CRITICAL',
  'monitoring-realtime':   'CRITICAL',
  'pediatrie':             'CRITICAL',
  'obstetrique':           'CRITICAL',
  'bloc-operatoire':       'CRITICAL',
  'samu-smur':             'CRITICAL',
  'telesurveillance':      'CRITICAL',

  // HIGH — clinique haute priorité
  'pharmacie':             'HIGH',
  'prescriptions':         'HIGH',
  'labo':                  'HIGH',
  'imagerie':              'HIGH',
  'transfusion':           'HIGH',
  'psychiatrie':           'HIGH',
  'soins-infirmiers':      'HIGH',
  'lits':                  'HIGH',

  // STANDARD — métier courant
  'consultations':         'STANDARD',
  'hospitalisation':       'STANDARD',
  'facturation':           'STANDARD',
  'pmsi':                  'STANDARD',
  'telemedecine':          'STANDARD',
  'sterilisation':         'STANDARD',
  'rh':                    'STANDARD',
  'audit':                 'STANDARD',

  // LOW — support / non-clinique
  'ged':                   'LOW',
  'carbon-footprint':      'LOW',
  'pedagogie':             'LOW',
  'afie':                  'LOW',
  'qualite':               'LOW',
  'cme':                   'LOW',
  'cse':                   'LOW',
  'bionettoyage':          'LOW',
  'hotellerie':            'LOW',
  'fleet':                 'LOW',

  // STANDARD additions
  'logistique':            'STANDARD',
  'recherche-clinique':    'STANDARD',
  'patient-portal':        'STANDARD',
  'planning':              'STANDARD',
  'accueil-familles':      'STANDARD',
  'pcm':                   'STANDARD',
  'mediation':             'STANDARD',
  'ssr':                   'STANDARD',
  'transport-externe':     'STANDARD',
  'gam':                   'STANDARD',
  'gmao':                  'STANDARD',

  // HIGH additions
  'ehpad':                 'HIGH',
  'had':                   'HIGH',
  'exam-requests':         'HIGH',
  'brancardage':           'HIGH',
  'soignscom':             'HIGH',
};

/**
 * Retourne les thresholds k6 formatés pour un module donné.
 * @param {string} moduleName — Nom du module (ex: 'urgences', 'monitoring-realtime')
 * @returns {object} thresholds k6
 */
export function getSLOThresholds(moduleName) {
  const level = MODULE_CRITICALITY[moduleName] || 'STANDARD';
  const slo = SLO_LEVELS[level];

  return {
    http_req_duration: [`p(95)<${slo.p95}`, `p(99)<${slo.p99}`],
    http_req_failed: [`rate<${slo.errorRate}`],
    checks: [`rate>${slo.checksRate}`],
  };
}

/**
 * Retourne les thresholds k6 pour un module + métriques write custom.
 */
export function getSLOThresholdsWithWrite(moduleName) {
  const base = getSLOThresholds(moduleName);
  const level = MODULE_CRITICALITY[moduleName] || 'STANDARD';
  const slo = SLO_LEVELS[level];

  return {
    ...base,
    write_latency: [`p(95)<${slo.p95}`, `p(99)<${slo.p99}`],
  };
}
