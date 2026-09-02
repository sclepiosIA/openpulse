/**
 * CRM utility functions for pipeline, contacts, search, and revenue calculations.
 * Extracted from business logic to enable proper unit testing.
 */

/** Status flow for etablissements */
export const STATUS_FLOW = ['Prospect', 'Rendez-vous pris', 'Négociation', 'Contractualisation', 'Déploiement', 'Production'] as const;

/** Pipeline probability weights by status */
export const PIPELINE_PROBABILITIES: Record<string, number> = {
  'Prospect': 0.1,
  'Rendez-vous pris': 0.3,
  'Négociation': 0.6,
  'Contractualisation': 0.9,
};

export function isValidTransition(from: string, to: string): boolean {
  const fromIndex = (STATUS_FLOW as readonly string[]).indexOf(from);
  const toIndex = (STATUS_FLOW as readonly string[]).indexOf(to);

  return toIndex >= fromIndex;
}

export function calculatePipelineValue(
  etablissements: Array<{ statut: string; valeur_contrat: number }>
): number {
  return etablissements.reduce((total, etab) => {
    const probability = PIPELINE_PROBABILITIES[etab.statut] || 0;
    return total + (etab.valeur_contrat * probability);
  }, 0);
}

export function formatContactName(contact: { prenom?: string; nom?: string; email: string }): string {
  if (contact.prenom && contact.nom) return `${contact.prenom} ${contact.nom}`;
  if (contact.nom) return contact.nom;
  return contact.email;
}

export function isValidFrenchPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s.-]/g, '');
  return /^(\+33|0)[1-9]\d{8}$/.test(cleaned);
}

export function calculatePriorityScore(task: {
  priorite: string;
  echeance: Date;
}): number {
  let score = 0;
  const priorityWeights: Record<string, number> = {
    'critique': 100,
    'haute': 75,
    'moyenne': 50,
    'basse': 25,
  };
  score += priorityWeights[task.priorite] || 50;

  const daysUntilDue = Math.ceil((task.echeance.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysUntilDue < 0) score += 50;
  else if (daysUntilDue < 3) score += 40;
  else if (daysUntilDue < 7) score += 30;
  else if (daysUntilDue < 14) score += 20;

  return score;
}

export function isTaskOverdue(echeance: Date): boolean {
  return echeance < new Date();
}

export function groupByRegion(
  etablissements: Array<{ id: string; region: string }>
): Record<string, string[]> {
  return etablissements.reduce((acc, etab) => {
    const region = etab.region || 'Non renseigné';
    if (!acc[region]) acc[region] = [];
    acc[region].push(etab.id);
    return acc;
  }, {} as Record<string, string[]>);
}

export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateMonthlyRevenue(etablissement: {
  modele_economique: string;
  prix_licence_mensuel?: number;
  prix_licence_annuel?: number;
  periodicite_paiement: string;
}): number {
  if (etablissement.modele_economique === 'Statique') {
    if (etablissement.periodicite_paiement === 'mensuel') {
      return etablissement.prix_licence_mensuel || 0;
    }
    if (etablissement.periodicite_paiement === 'annuel') {
      return (etablissement.prix_licence_annuel || 0) / 12;
    }
  }
  return 0;
}

export function formatForCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      const value = row[h];
      if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
      return value ?? '';
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

export function buildSearchQuery(term: string): string {
  return `%${term.replace(/[%_]/g, '\\$&')}%`;
}

export interface EtablissementFilter {
  search?: string;
  region?: string;
  statut?: string;
}

export function filterEtablissements<T extends { nom: string; region: string; statut: string }>(
  etablissements: T[],
  filters: EtablissementFilter
): T[] {
  return etablissements.filter(etab => {
    if (filters.search && !etab.nom.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.region && etab.region !== filters.region) return false;
    if (filters.statut && etab.statut !== filters.statut) return false;
    return true;
  });
}
