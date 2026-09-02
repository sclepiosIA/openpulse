// Types pour le simulateur de valorisation des urgences OpenPulse

/**
 * Paramètres de simulation principaux
 */
export interface SimulationParams {
  // Volume
  passages: number;  // Passages annuels

  // Taux UHCD
  baseline: number;  // Taux actuel UHCD (%)
  cible: number;     // Taux cible UHCD (%)
  taux_mono: number; // Proportion mono-RUM (%)

  // Taux des leviers additionnels
  taux_avis_baseline: number;  // Taux avis spécialisés actuel (%)
  taux_avis_cible: number;     // Taux avis spécialisés cible (%)
  taux_ccmu2_baseline: number; // Taux CCMU2 actuel (%)
  taux_ccmu2_cible: number;    // Taux CCMU2 cible (%)
  taux_ccmu3_baseline: number; // Taux CCMU3 actuel (%)
  taux_ccmu3_cible: number;    // Taux CCMU3 cible (%)

  // Tarifs unitaires
  TARIF_UHCD: number;      // Tarif unitaire par UHCD (€)
  TARIF_AVIS_SPE: number;  // Tarif unitaire avis spécialisé (€)
  TARIF_CCMU2: number;     // Tarif unitaire CCMU niveau 2+ (€)
  TARIF_CCMU3: number;     // Tarif unitaire CCMU niveau 3+ (€)
  BONUS_MONORUM: number;   // Majoration UHCD mono-RUM (décimal)
}

/**
 * Résultats de calcul d'un levier de valorisation
 */
export interface LevierRow {
  levier: string;
  volumeBaseline: number;
  gainBaseline: number;
  volumeTarget: number;
  gainTarget: number;
  volumeDiff: number;
  gainDiff: number;
}

/**
 * Résultats complets de la simulation
 */
export interface SimulationResults {
  // Volumes
  uhcdBaseline: number;
  uhcdTarget: number;
  uhcdDiff: number;
  monoBaseline: number;
  monoTarget: number;
  consultExtBaseline: number;
  consultExtTarget: number;

  // Leviers détaillés
  leviers: LevierRow[];

  // Totaux
  totalGainBaseline: number;
  totalGainTarget: number;
  totalGainDiff: number;

  // Gain moyen par dossier UHCD supplémentaire
  gainParDossier: number;
}

/**
 * Type de centre hospitalier pour le calcul de devis
 */
export interface CenterType {
  id: string;
  name: string;
  prixPAU: number;               // Prix par PAU (€)
  multiplicateurFrais: number;   // Multiplicateur frais d'accès
}

/**
 * Type de DPI (Dossier Patient Informatisé)
 */
export interface DPIType {
  id: string;
  name: string;
  baseFrais: number;  // Frais d'accès de base (€)
}

/**
 * Type de revendeur (optionnel)
 */
export interface ResellerType {
  id: string;
  name: string;
  markup: number;  // Markup en décimal (ex: 0.5 = +50%)
}

/**
 * Niveau de valorisation (Premier = UHCD seul, Second = UHCD + avis spé + CCMU)
 */
export type ValorisationLevel = 'premier' | 'second';

/**
 * Configuration complète du devis
 */
export interface QuoteConfiguration {
  centerType: CenterType;
  dpiType: DPIType;
  resellerType: ResellerType | null;
  valorisationLevel: ValorisationLevel;
}

/**
 * Projection par palier du modèle au succès
 */
export interface ProjectionPalier {
  palier: number;
  description: string;
  
  // Taux et volumes
  tauxObjectif: number;
  nouveauTauxMonoRumSurTotal: number;
  uhcdObjectif: number;
  uhcdSupplementaires: number;
  uhcdMonoRumObjectif: number;
  
  // Coûts
  multiplicateur: number;
  fraisAcces: number;
  prixSolution: number;
  coutTotal: number;
  
  // Avec markup revendeur
  fraisAccesRevendeur: number;
  prixSolutionRevendeur: number;
  coutTotalRevendeur: number;
  
  // ROI
  roiTotal: number;
  roiNet: number;
  roiPourcentage: number;
  
  // Détail ROI par levier
  roiUhcd: number;
  roiAvisSpec: number;
  roiCcmu2: number;
  roiCcmu3: number;
  roiMonoUhcdBonus: number;
}

/**
 * Résultats complets du calcul de devis
 */
export interface QuoteResults {
  configuration: QuoteConfiguration;
  passagesAnnuels: number;
  uhcdActuels: number;
  uhcdMonoRum: number;
  tauxUhcdMonoRumSurTotal: number;
  paliers: ProjectionPalier[];
  
  // Baseline pour calcul des différentiels
  gainUhcdBaseline: number;
  gainAvisBaseline: number;
  gainCcmu2Baseline: number;
  gainCcmu3Baseline: number;
}

/**
 * Paramètres du module Analytics (données mensuelles)
 */
export interface AnalyticsParams {
  uhcdMois: number;       // UHCD mensuels actuels
  consultMois: number;    // Consultations mensuelles
  plusMois: number;       // UHCD supplémentaires mensuels estimés avec OpenPulse
  totalProj: number;      // Total de passages à projeter
}

/**
 * Résultats du module Analytics
 */
export interface AnalyticsResults {
  // Annualisé
  uhcdAn: number;
  consultAn: number;
  uhcdMarqueAn: number;
  totalPassagesInit: number;
  
  // Taux UHCD
  pctUhcd: number;
  pctUhcdPlus: number;
  
  // Avec OpenPulse
  uhcdPlusTotal: number;
  consultAnPlus: number;
  
  // Revenus baseline
  revUhcdBase: number;
  revAvisBase: number;
  revCcmu2Base: number;
  revCcmu3Base: number;
  revTotalBase: number;
  
  // Revenus avec OpenPulse
  revUhcdPlus: number;
  revAvisPlus: number;
  revCcmu2Plus: number;
  revCcmu3Plus: number;
  gainMonoRUM: number;
  revTotalPlus: number;
  
  // ROI en pourcentage
  roiAnUhcdPct: number;
  roiAnTotalPct: number;
  
  // Projections scalées
  scale: number;
  uhcdProj: number;
  uhcdPlusProj: number;
}

/**
 * Données complètes du simulateur (pour sauvegarde)
 */
export interface SimulatorData {
  params: SimulationParams;
  configuration: QuoteConfiguration | null;
  simulationResults: SimulationResults | null;
  quoteResults: QuoteResults | null;
  analyticsParams: AnalyticsParams | null;
  analyticsResults: AnalyticsResults | null;
}

/**
 * Mode de saisie des taux
 */
export type InputMode = 'percent' | 'absolute';

/**
 * Onglet actif du simulateur
 */
export type SimulatorTab = 'simulation' | 'devis' | 'analytics';
