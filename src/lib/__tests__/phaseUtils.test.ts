import { describe, it, expect } from 'vitest';
import { isInPhase, filterByPhase, countByPhase, getPhaseForStatus } from '../phaseUtils';

describe('phaseUtils', () => {
  const items = [
    { statut: 'Prospect', id: 1 },
    { statut: 'RDV pris', id: 2 },
    { statut: 'Production', id: 3 },
    { statut: 'Déploiement', id: 4 },
    { statut: 'Inconnu', id: 5 },
  ];

  describe('isInPhase', () => {
    it('matches statuts in the right phase', () => {
      expect(isInPhase('Prospect', 'commercial')).toBe(true);
      expect(isInPhase('Production', 'production')).toBe(true);
      expect(isInPhase('Déploiement', 'deploiement')).toBe(true);
    });
    it('returns false for mismatches', () => {
      expect(isInPhase('Prospect', 'production')).toBe(false);
      expect(isInPhase('Inconnu', 'commercial')).toBe(false);
    });
  });

  describe('filterByPhase / countByPhase', () => {
    it('filters commercial items', () => {
      const r = filterByPhase(items, 'commercial');
      expect(r.map(i => i.id).sort()).toEqual([1, 2]);
    });
    it('counts production items', () => {
      expect(countByPhase(items, 'production')).toBe(1);
    });
    it('returns empty when no match', () => {
      expect(filterByPhase([{ statut: 'Inconnu' }], 'commercial')).toEqual([]);
      expect(countByPhase([], 'commercial')).toBe(0);
    });
  });

  describe('getPhaseForStatus', () => {
    it('returns the matching phase', () => {
      expect(getPhaseForStatus('Prospect')).toBe('commercial');
      expect(getPhaseForStatus('Production')).toBe('production');
      expect(getPhaseForStatus('Déploiement')).toBe('deploiement');
    });
    it('returns null for unknown', () => {
      expect(getPhaseForStatus('NimporteQuoi')).toBeNull();
    });
  });
});
