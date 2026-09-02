// Utilitaires centralisés pour la page Analyse Géographique
import { debug } from '@/lib/debug';
import { FALLBACK_TYPES_ETABLISSEMENT, FALLBACK_DPI } from '@/config/referenceDataDefaults';
import { getGeoPhaseFromStatus, GEO_PHASE_COLORS } from '@/config/phases';

import type { EtablissementForGeo } from '@/types/etablissement-geo';

// Re-export for backward compatibility
export const getPhaseFromStatut = getGeoPhaseFromStatus;

/**
 * @deprecated Use GEO_PHASE_COLORS from config/phases.ts instead
 */
export const PHASE_COLORS: Record<string, string> = GEO_PHASE_COLORS

export const PHASE_LABELS_FR: Record<string, string> = {
  all: 'Tous',
  prospects: 'Prospects',
  deploiement: 'Déploiement',
  production: 'Production',
}

/** @deprecated Use useTypesEtablissement() hook instead */
export const ETABLISSEMENT_TYPES = FALLBACK_TYPES_ETABLISSEMENT
/** @deprecated Use useDpiList() hook instead */
export const DPI_OPTIONS = FALLBACK_DPI

export function formatDateFr(date: string | Date | null | undefined): string {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'N/A'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(amount)
}

export function exportEtablissementsToCSV(etablissements: EtablissementForGeo[], filename: string = 'etablissements'): void {
  const headers = [
    'Nom',
    'Ville',
    'Région',
    'Type',
    'Statut',
    'DPI',
    'Commercial',
    'Chef de projet',
    'CSM',
    'Date signature',
    'Date Go-Live',
    'Passages annuels'
  ]

  const rows = etablissements.map(etab => [
    etab.nom || '',
    etab.ville || '',
    etab.region || '',
    etab.type || '',
    etab.statut || '',
    etab.dpi || '',
    etab.commercial?.prenom && etab.commercial?.nom 
      ? `${etab.commercial.prenom} ${etab.commercial.nom}` 
      : '',
    etab.chef_projet?.prenom && etab.chef_projet?.nom 
      ? `${etab.chef_projet.prenom} ${etab.chef_projet.nom}` 
      : '',
    etab.csm?.prenom && etab.csm?.nom 
      ? `${etab.csm.prenom} ${etab.csm.nom}` 
      : '',
    formatDateFr(etab.date_signature),
    formatDateFr(etab.date_go_live),
    etab.nombre_passages_urgences_annuel || ''
  ])

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
  ].join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

// Filtres par défaut à persister
export const DEFAULT_GEO_FILTERS = {
  search: '',
  regions: [] as string[],
  types: [] as string[],
  phases: [] as string[],
  dpis: [] as string[],
  commercialId: undefined as string | undefined,
  chefProjetId: undefined as string | undefined,
  csmId: undefined as string | undefined,
}

export type GeoFilters = typeof DEFAULT_GEO_FILTERS

export function loadGeoFilters(): GeoFilters {
  try {
    const saved = localStorage.getItem('geo-filters')
    if (saved) {
      return { ...DEFAULT_GEO_FILTERS, ...JSON.parse(saved) }
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      debug.warn('Failed to load geo filters:', e)
    }
  }
  return DEFAULT_GEO_FILTERS
}

export function saveGeoFilters(filters: GeoFilters): void {
  try {
    localStorage.setItem('geo-filters', JSON.stringify(filters))
  } catch (e) {
    if (import.meta.env.DEV) {
      debug.warn('Failed to save geo filters:', e)
    }
  }
}
