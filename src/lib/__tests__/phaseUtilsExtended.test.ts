import { describe, it, expect } from 'vitest';
import { isInPhase, filterByPhase, countByPhase, getPhaseForStatus } from '../phaseUtils';

describe('phaseUtils', () => {
  describe('isInPhase', () => {
    it('Prospect is commercial', () => expect(isInPhase('Prospect', 'commercial')).toBe(true));
    it('Production is production', () => expect(isInPhase('Production', 'production')).toBe(true));
    it('Contractuel is deploiement', () => expect(isInPhase('Contractuel', 'deploiement')).toBe(true));
    it('Production is NOT commercial', () => expect(isInPhase('Production', 'commercial')).toBe(false));
  });

  describe('filterByPhase', () => {
    const items = [
      { statut: 'Prospect' },
      { statut: 'Production' },
      { statut: 'Contractuel' },
    ];
    it('filters commercial', () => expect(filterByPhase(items, 'commercial').length).toBe(1));
    it('filters production', () => expect(filterByPhase(items, 'production').length).toBe(1));
    it('filters deploiement', () => expect(filterByPhase(items, 'deploiement').length).toBe(1));
  });

  describe('countByPhase', () => {
    const items = [
      { statut: 'Prospect' },
      { statut: 'RDV pris' },
      { statut: 'Production' },
    ];
    it('counts commercial = 2', () => expect(countByPhase(items, 'commercial')).toBe(2));
    it('counts production = 1', () => expect(countByPhase(items, 'production')).toBe(1));
  });

  describe('getPhaseForStatus', () => {
    it('Prospect → commercial', () => expect(getPhaseForStatus('Prospect')).toBe('commercial'));
    it('Production → production', () => expect(getPhaseForStatus('Production')).toBe('production'));
    it('Formation → deploiement', () => expect(getPhaseForStatus('Formation')).toBe('deploiement'));
    it('Unknown → null', () => expect(getPhaseForStatus('UnknownStatus')).toBeNull());
  });
});
