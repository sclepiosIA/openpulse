import { describe, it, expect } from 'vitest';
import {
  STATUS_FLOW,
  PIPELINE_PROBABILITIES,
  isValidTransition,
  calculatePipelineValue,
  formatContactName,
  isValidFrenchPhone,
  calculatePriorityScore,
  isTaskOverdue,
  groupByRegion,
  haversineDistance,
  calculateMonthlyRevenue,
  formatForCSV,
  buildSearchQuery,
  filterEtablissements,
} from '../crmUtils';

describe('crmUtils', () => {
  it('STATUS_FLOW length and order', () => {
    expect(STATUS_FLOW[0]).toBe('Prospect');
    expect(STATUS_FLOW.at(-1)).toBe('Production');
  });

  it('isValidTransition forward allowed, backward rejected', () => {
    expect(isValidTransition('Prospect', 'Négociation')).toBe(true);
    expect(isValidTransition('Production', 'Prospect')).toBe(false);
    expect(isValidTransition('Prospect', 'Prospect')).toBe(true);
  });

  it('calculatePipelineValue applies weights', () => {
    const v = calculatePipelineValue([
      { statut: 'Prospect', valeur_contrat: 1000 },
      { statut: 'Négociation', valeur_contrat: 1000 },
      { statut: 'Unknown', valeur_contrat: 1000 },
    ]);
    expect(v).toBe(100 + 600 + 0);
    expect(PIPELINE_PROBABILITIES['Contractualisation']).toBe(0.9);
  });

  it('formatContactName fallbacks', () => {
    expect(formatContactName({ prenom: 'A', nom: 'B', email: 'x@x.fr' })).toBe('A B');
    expect(formatContactName({ nom: 'B', email: 'x@x.fr' })).toBe('B');
    expect(formatContactName({ email: 'x@x.fr' })).toBe('x@x.fr');
  });

  it('isValidFrenchPhone', () => {
    expect(isValidFrenchPhone('0612345678')).toBe(true);
    expect(isValidFrenchPhone('+33612345678')).toBe(true);
    expect(isValidFrenchPhone('06 12 34 56 78')).toBe(true);
    expect(isValidFrenchPhone('123')).toBe(false);
    expect(isValidFrenchPhone('0012345678')).toBe(false);
  });

  it('calculatePriorityScore', () => {
    const future = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const past = new Date(Date.now() - 24 * 3600 * 1000);
    expect(calculatePriorityScore({ priorite: 'critique', echeance: future })).toBe(100);
    expect(calculatePriorityScore({ priorite: 'haute', echeance: past })).toBe(125);
    expect(calculatePriorityScore({ priorite: 'inconnue', echeance: future })).toBe(50);
  });

  it('isTaskOverdue', () => {
    expect(isTaskOverdue(new Date(Date.now() - 1000))).toBe(true);
    expect(isTaskOverdue(new Date(Date.now() + 100000))).toBe(false);
  });

  it('groupByRegion', () => {
    const out = groupByRegion([
      { id: '1', region: 'IDF' },
      { id: '2', region: 'IDF' },
      { id: '3', region: '' },
    ]);
    expect(out['IDF']).toEqual(['1', '2']);
    expect(out['Non renseigné']).toEqual(['3']);
  });

  it('haversineDistance ~0 same point', () => {
    expect(haversineDistance(48.85, 2.35, 48.85, 2.35)).toBeCloseTo(0);
  });

  it('calculateMonthlyRevenue', () => {
    expect(calculateMonthlyRevenue({
      modele_economique: 'Statique', periodicite_paiement: 'mensuel', prix_licence_mensuel: 500,
    })).toBe(500);
    expect(calculateMonthlyRevenue({
      modele_economique: 'Statique', periodicite_paiement: 'annuel', prix_licence_annuel: 1200,
    })).toBe(100);
    expect(calculateMonthlyRevenue({
      modele_economique: 'Dynamique', periodicite_paiement: 'mensuel',
    })).toBe(0);
  });

  it('formatForCSV escapes commas', () => {
    const csv = formatForCSV([{ a: 'hello,world', b: 1 }]);
    expect(csv).toContain('"hello,world"');
    expect(formatForCSV([])).toBe('');
  });

  it('buildSearchQuery escapes wildcards', () => {
    expect(buildSearchQuery('foo')).toBe('%foo%');
    expect(buildSearchQuery('50%')).toBe('%50\\%%');
  });

  it('filterEtablissements', () => {
    const data = [
      { nom: 'Alpha', region: 'IDF', statut: 'Prospect' },
      { nom: 'Beta', region: 'PACA', statut: 'Production' },
    ];
    expect(filterEtablissements(data, { search: 'alp' })).toHaveLength(1);
    expect(filterEtablissements(data, { region: 'PACA' })).toHaveLength(1);
    expect(filterEtablissements(data, { statut: 'Prospect' })).toHaveLength(1);
    expect(filterEtablissements(data, {})).toHaveLength(2);
  });
});
