import type { CenterType, DPIType, ResellerType, SimulationParams } from '@/types/simulator';

/**
 * Valeurs par défaut des paramètres de simulation
 */
export const DEFAULT_SIMULATION_PARAMS: SimulationParams = {
  // Volume
  passages: 40000,

  // Taux UHCD
  baseline: 5,
  cible: 11,
  taux_mono: 70,

  // Taux des leviers additionnels
  taux_avis_baseline: 3,
  taux_avis_cible: 7,
  taux_ccmu2_baseline: 2,
  taux_ccmu2_cible: 5,
  taux_ccmu3_baseline: 2,
  taux_ccmu3_cible: 5,

  // Tarifs unitaires
  TARIF_UHCD: 400,
  TARIF_AVIS_SPE: 31.5,
  TARIF_CCMU2: 14.53,
  TARIF_CCMU3: 19.38,
  BONUS_MONORUM: 0.05,
};

/**
 * Types de centres hospitaliers
 */
export const CENTER_TYPES: CenterType[] = [
  {
    id: 'ch',
    name: 'Centres Hospitaliers',
    prixPAU: 2.00,
    multiplicateurFrais: 1.0,
  },
  {
    id: 'chu',
    name: 'Établissements supports & CHU',
    prixPAU: 2.30,
    multiplicateurFrais: 1.5,
  },
  {
    id: 'ght',
    name: 'Groupements Hospitaliers de Territoire (GHT)',
    prixPAU: 2.60,
    multiplicateurFrais: 2.0,
  },
];

/**
 * Types de DPI (Dossier Patient Informatisé)
 */
export const DPI_TYPES: DPIType[] = [
  {
    id: 'web',
    name: 'DPI Web',
    baseFrais: 5000,
  },
  {
    id: 'non-web',
    name: 'DPI Non-Web',
    baseFrais: 10000,
  },
];

/**
 * Types de revendeurs (optionnel)
 */
export const RESELLER_TYPES: ResellerType[] = [
  {
    id: 'softway',
    name: 'Softway Médical',
    markup: 0.50,
  },
  {
    id: 'effigen',
    name: 'Effigen',
    markup: 0.40,
  },
];

/**
 * Configuration des 4 paliers du modèle au succès
 */
export const PALIER_CONFIG = [
  {
    palier: 1,
    description: 'Palier 1 - Minimale',
    conditionMin: 0,
    conditionMax: 8,
    multiplicateur: 0.25,
    augmentationMonoRum: 1,
  },
  {
    palier: 2,
    description: 'Palier 2 - Intermédiaire 1',
    conditionMin: 8,
    conditionMax: 9,
    multiplicateur: 0.50,
    augmentationMonoRum: 2,
  },
  {
    palier: 3,
    description: 'Palier 3 - Intermédiaire 2',
    conditionMin: 9,
    conditionMax: 10,
    multiplicateur: 0.975,
    augmentationMonoRum: 3,
  },
  {
    palier: 4,
    description: 'Palier 4 - Maximale',
    conditionMin: 10,
    conditionMax: Infinity,
    multiplicateur: 1.50,
    augmentationMonoRum: 4,
  },
];

/**
 * Couleurs du design OpenPulse
 */
export const SIMULATOR_COLORS = {
  blue: {
    25: '#F0F6FF',
    50: '#E0ECFF',
    100: '#C2D9FF',
    200: '#85B3FF',
    500: '#2563EB',
    600: '#1D4ED8',
    700: '#1E40AF',
    800: '#1E3A8A',
  },
  orange: {
    500: '#F97316',
  },
};

/**
 * Noms des leviers de valorisation
 */
export const LEVIER_NAMES = {
  avis: 'Avis spécialisés',
  ccmu2: 'CCMU 2+',
  ccmu3: 'CCMU 3 et au-dessus',
  uhcd: 'UHCD Mono-RUM',
  bonus: 'Majoration 5% mono-RUM',
};

/**
 * Formatage des nombres en euros
 */
export function formatEuro(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Formatage des nombres avec séparateurs
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(value));
}

/**
 * Formatage des pourcentages
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Récupère le type de centre par ID
 */
export function getCenterTypeById(id: string): CenterType | undefined {
  return CENTER_TYPES.find(ct => ct.id === id);
}

/**
 * Récupère le type de DPI par ID
 */
export function getDPITypeById(id: string): DPIType | undefined {
  return DPI_TYPES.find(dt => dt.id === id);
}

/**
 * Récupère le revendeur par ID
 */
export function getResellerTypeById(id: string): ResellerType | undefined {
  return RESELLER_TYPES.find(rt => rt.id === id);
}
