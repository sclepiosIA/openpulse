/**
 * k6 Scenarios — 8 profils de charge POINT Healthcare
 */

/** Smoke: validation rapide, 1 VU, 30s */
export const smoke = {
  executor: 'constant-vus',
  vus: 1,
  duration: '30s',
};

/** Standard: charge normale, 10 VU, 2min */
export const standard = {
  executor: 'constant-arrival-rate',
  rate: 10,
  timeUnit: '1s',
  duration: '2m',
  preAllocatedVUs: 20,
  maxVUs: 50,
};

/** Stress: montée progressive */
export const stress = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: [
    { duration: '1m', target: 20 },
    { duration: '2m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 0 },
  ],
};

/** Spike: pic brutal */
export const spike = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: [
    { duration: '10s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '10s', target: 0 },
  ],
};

/** Soak: endurance longue durée */
export const soak = {
  executor: 'constant-vus',
  vus: 20,
  duration: '15m',
};

/**
 * Morning Peak: pic matinal 6h-9h (saisie soins infirmiers)
 * Montée rapide → plateau haut → descente progressive
 */
export const morning_peak = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: [
    { duration: '30s', target: 50 },   // arrivée équipe matin
    { duration: '3m', target: 150 },    // pic saisie soins
    { duration: '2m', target: 100 },    // stabilisation
    { duration: '1m', target: 30 },     // fin de pic
  ],
};

/**
 * Emergency Peak: afflux massif aux urgences
 * Spike brutal suivi d'un plateau soutenu
 */
export const emergency_peak = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: [
    { duration: '15s', target: 80 },    // afflux brutal
    { duration: '3m', target: 200 },    // pic urgences
    { duration: '2m', target: 200 },    // plateau soutenu
    { duration: '30s', target: 0 },     // résolution
  ],
};

/**
 * Night Shift: garde de nuit (charge réduite mais continue)
 * Faible volume, longue durée, avec micro-pics d'alertes
 */
export const night_shift = {
  executor: 'ramping-vus',
  startVUs: 5,
  stages: [
    { duration: '2m', target: 10 },     // début de garde
    { duration: '1m', target: 30 },     // alerte nocturne
    { duration: '3m', target: 10 },     // retour au calme
    { duration: '1m', target: 25 },     // 2e alerte
    { duration: '2m', target: 8 },      // fin de garde
  ],
};

export function getScenario(name) {
  const map = { smoke, standard, stress, spike, soak, morning_peak, emergency_peak, night_shift };
  return map[name] || smoke;
}
