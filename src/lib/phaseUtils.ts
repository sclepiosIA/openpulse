// Phase utilities - centralized functions for filtering and counting by phase

import { PHASE_GROUPS, PhaseKey } from '@/config/phases'

/**
 * Check if a status belongs to a specific phase
 */
export function isInPhase(statut: string, phase: PhaseKey): boolean {
  return (PHASE_GROUPS[phase].statuts as readonly string[]).includes(statut)
}

/**
 * Filter items by phase based on their statut
 */
export function filterByPhase<T extends { statut: string }>(
  items: T[], 
  phase: PhaseKey
): T[] {
  return items.filter(item => isInPhase(item.statut, phase))
}

/**
 * Count items belonging to a specific phase
 */
export function countByPhase<T extends { statut: string }>(
  items: T[], 
  phase: PhaseKey
): number {
  return items.filter(item => isInPhase(item.statut, phase)).length
}

/**
 * Get the phase key for a given status
 */
export function getPhaseForStatus(statut: string): PhaseKey | null {
  for (const [key, phase] of Object.entries(PHASE_GROUPS)) {
    if ((phase.statuts as readonly string[]).includes(statut)) {
      return key as PhaseKey
    }
  }
  return null
}
