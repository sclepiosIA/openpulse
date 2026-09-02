import { describe, it, expect } from 'vitest';
import {
  PHASE_GROUPS,
  getPhaseCategoriesArray,
  getCumulativeCategoriesUpToPhase,
  getPhaseByStatus,
  getPhaseByCategory,
  getPhaseOrder,
  GEO_PHASE_COLORS,
  getGeoPhaseFromStatus,
} from '../phases';

describe('phases config', () => {
  describe('PHASE_GROUPS', () => {
    it('has 3 phases', () => expect(Object.keys(PHASE_GROUPS).length).toBe(3));
    it('commercial has Prospect but excludes the special GHT relationship status', () => {
      expect(PHASE_GROUPS.commercial.statuts).toContain('Prospect');
      expect(PHASE_GROUPS.commercial.statuts).not.toContain('Autre compte / GHT');
    });
    it('deploiement has Contractuel', () => expect(PHASE_GROUPS.deploiement.statuts).toContain('Contractuel'));
    it('production has Production', () => expect(PHASE_GROUPS.production.statuts).toContain('Production'));
  });

  describe('getPhaseCategoriesArray', () => {
    it('commercial → includes commercial', () => expect(getPhaseCategoriesArray('commercial')).toContain('commercial'));
    it('production → includes support', () => expect(getPhaseCategoriesArray('production')).toContain('support'));
  });

  describe('getCumulativeCategoriesUpToPhase', () => {
    it('commercial only', () => {
      const cats = getCumulativeCategoriesUpToPhase('commercial');
      expect(cats).toContain('commercial');
      expect(cats).not.toContain('support');
    });
    it('production includes all', () => {
      const cats = getCumulativeCategoriesUpToPhase('production');
      expect(cats).toContain('commercial');
      expect(cats).toContain('support');
    });
  });

  describe('getPhaseByStatus', () => {
    it('Prospect → commercial', () => expect(getPhaseByStatus('Prospect')).toBe('commercial'));
    it('Autre compte / GHT → null', () => expect(getPhaseByStatus('Autre compte / GHT')).toBeNull());
    it('Production → production', () => expect(getPhaseByStatus('Production')).toBe('production'));
    it('Unknown → null', () => expect(getPhaseByStatus('Xyz')).toBeNull());
  });

  describe('getPhaseByCategory', () => {
    it('commercial → commercial', () => expect(getPhaseByCategory('commercial')).toBe('commercial'));
    it('support → production', () => expect(getPhaseByCategory('support')).toBe('production'));
    it('unknown → null', () => expect(getPhaseByCategory('xyz')).toBeNull());
  });

  describe('getPhaseOrder', () => {
    it('commercial = 0', () => expect(getPhaseOrder('commercial')).toBe(0));
    it('deploiement = 1', () => expect(getPhaseOrder('deploiement')).toBe(1));
    it('production = 2', () => expect(getPhaseOrder('production')).toBe(2));
  });

  describe('GEO_PHASE_COLORS', () => {
    it('has 4 entries', () => expect(Object.keys(GEO_PHASE_COLORS).length).toBe(4));
  });

  describe('getGeoPhaseFromStatus', () => {
    it('Prospect → prospects', () => expect(getGeoPhaseFromStatus('Prospect')).toBe('prospects'));
    it('Autre compte / GHT → prospects', () => expect(getGeoPhaseFromStatus('Autre compte / GHT')).toBe('prospects'));
    it('Production → production', () => expect(getGeoPhaseFromStatus('Production')).toBe('production'));
    it('Contractuel → deploiement', () => expect(getGeoPhaseFromStatus('Contractuel')).toBe('deploiement'));
    it('Refus → hors_pipeline', () => expect(getGeoPhaseFromStatus('Refus')).toBe('hors_pipeline'));
    it('Unknown → prospects (fallback)', () => expect(getGeoPhaseFromStatus('Unknown')).toBe('prospects'));
  });
});
