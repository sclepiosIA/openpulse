import { Briefcase, Rocket, Settings } from "lucide-react";
import { PHASE_STATUTS } from './statusConfig';

export const PHASE_GROUPS = {
  commercial: {
    key: 'commercial',
    label: 'Commercial',
    icon: Briefcase,
    color: 'hsl(var(--chart-1))',
    bgColor: 'bg-chart-1/10',
    borderColor: 'border-chart-1/20',
    // Le rattachement « Autre compte / GHT » reste sélectionnable, mais ne
    // constitue pas une phase de tâches commerciales.
    statuts: PHASE_STATUTS.prospect.filter(statut => statut !== 'Autre compte / GHT'),
    categories: ['commercial']
  },
  deploiement: {
    key: 'deploiement',
    label: 'Déploiement',
    icon: Rocket,
    color: 'hsl(var(--chart-3))',
    bgColor: 'bg-chart-3/10',
    borderColor: 'border-chart-3/20',
    statuts: PHASE_STATUTS.deploiement,
    categories: ['contractuel', 'conformité', 'configuration', 'déploiement', 'formation', 'documentation', 'go-live']
  },
  production: {
    key: 'production',
    label: 'Production',
    icon: Settings,
    color: 'hsl(var(--chart-2))',
    bgColor: 'bg-chart-2/10',
    borderColor: 'border-chart-2/20',
    statuts: PHASE_STATUTS.production,
    categories: ['suivi production', 'suivi', 'support']
  }
} as const;

export type PhaseKey = keyof typeof PHASE_GROUPS;

// Get all categories for a given phase
export const getPhaseCategoriesArray = (phase: PhaseKey): readonly string[] => {
  return PHASE_GROUPS[phase].categories;
};

// Get all categories up to and including a phase (for preserving tasks from previous phases)
export const getCumulativeCategoriesUpToPhase = (phase: PhaseKey): string[] => {
  const phases: PhaseKey[] = ['commercial', 'deploiement', 'production'];
  const phaseIndex = phases.indexOf(phase);
  
  const categories: string[] = [];
  for (let i = 0; i <= phaseIndex; i++) {
    categories.push(...PHASE_GROUPS[phases[i]].categories);
  }
  return categories;
};

export const getPhaseByStatus = (statut: string): PhaseKey | null => {
  for (const [key, phase] of Object.entries(PHASE_GROUPS)) {
    if ((phase.statuts as readonly string[]).includes(statut)) {
      return key as PhaseKey;
    }
  }
  return null;
};

export const getPhaseByCategory = (category: string): PhaseKey | null => {
  for (const [key, phase] of Object.entries(PHASE_GROUPS)) {
    if ((phase.categories as readonly string[]).some(cat => cat.toLowerCase() === category.toLowerCase())) {
      return key as PhaseKey;
    }
  }
  return null;
};

// Get the phase order (0 = commercial, 1 = deploiement, 2 = production)
export const getPhaseOrder = (phase: PhaseKey): number => {
  const phases: PhaseKey[] = ['commercial', 'deploiement', 'production'];
  return phases.indexOf(phase);
};

// Geo-analysis phase mapping: maps PhaseKey to geo labels used by the geographic analysis module
const PHASE_TO_GEO_LABEL: Record<PhaseKey, string> = {
  commercial: 'prospects',
  deploiement: 'deploiement',
  production: 'production',
};

/** Centralized colors for geo phase labels */
export const GEO_PHASE_COLORS: Record<string, string> = {
  prospects: '#f59e0b',     // Amber/Orange
  deploiement: '#3b82f6',   // Bleu
  production: '#10b981',    // Vert
  hors_pipeline: '#6b7280', // Gris
};

/**
 * Get the geographic analysis phase label for a given status.
 * Returns 'prospects' | 'deploiement' | 'production' | 'hors_pipeline'
 */
export const getGeoPhaseFromStatus = (statut: string): string => {
  // Special cases not in PHASE_GROUPS
  const horsPipeline = ['Refus', 'Reporté', 'Bloqué', 'Suspendu'];
  if (horsPipeline.includes(statut)) return 'hors_pipeline';

  const phase = getPhaseByStatus(statut);
  if (!phase) return 'prospects'; // default fallback
  return PHASE_TO_GEO_LABEL[phase] || 'prospects';
};
