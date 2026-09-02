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

describe('phases (extended)', () => {
  describe('PHASE_GROUPS', () => {
    it('has 3 phases', () => expect(Object.keys(PHASE_GROUPS).length).toBe(3));
    it('commercial has 8 statuts', () => expect(PHASE_GROUPS.commercial.statuts.length).toBe(8));
    it('deploiement has 7 statuts', () => expect(PHASE_GROUPS.deploiement.statuts.length).toBe(7));
    it('production has 1 statut', () => expect(PHASE_GROUPS.production.statuts.length).toBe(1));
    it('each has color/bgColor/borderColor', () => {
      Object.values(PHASE_GROUPS).forEach(p => {
        expect(p.color).toContain('hsl');
        expect(p.bgColor).toContain('bg-');
        expect(p.borderColor).toContain('border-');
      });
    });
  });

  describe('getPhaseCategoriesArray', () => {
    it('commercial → includes commercial', () => expect(getPhaseCategoriesArray('commercial')).toContain('commercial'));
    it('deploiement → includes formation', () => expect(getPhaseCategoriesArray('deploiement')).toContain('formation'));
    it('production → includes suivi', () => expect(getPhaseCategoriesArray('production')).toContain('suivi'));
  });

  describe('getCumulativeCategoriesUpToPhase', () => {
    it('commercial → only commercial cats', () => {
      const cats = getCumulativeCategoriesUpToPhase('commercial');
      expect(cats).toContain('commercial');
      expect(cats).not.toContain('formation');
    });
    it('production → all cats', () => {
      const cats = getCumulativeCategoriesUpToPhase('production');
      expect(cats).toContain('commercial');
      expect(cats).toContain('formation');
      expect(cats).toContain('suivi');
    });
  });

  describe('getPhaseByStatus', () => {
    it('Prospect → commercial', () => expect(getPhaseByStatus('Prospect')).toBe('commercial'));
    it('Autre compte / GHT → null', () => expect(getPhaseByStatus('Autre compte / GHT')).toBeNull());
    it('Contractuel → deploiement', () => expect(getPhaseByStatus('Contractuel')).toBe('deploiement'));
    it('Production → production', () => expect(getPhaseByStatus('Production')).toBe('production'));
    it('Unknown → null', () => expect(getPhaseByStatus('Unknown')).toBeNull());
  });

  describe('getPhaseByCategory', () => {
    it('commercial → commercial', () => expect(getPhaseByCategory('commercial')).toBe('commercial'));
    it('formation → deploiement', () => expect(getPhaseByCategory('formation')).toBe('deploiement'));
    it('suivi → production', () => expect(getPhaseByCategory('suivi')).toBe('production'));
    it('case insensitive', () => expect(getPhaseByCategory('COMMERCIAL')).toBe('commercial'));
    it('unknown → null', () => expect(getPhaseByCategory('xyz')).toBeNull());
  });

  describe('getPhaseOrder', () => {
    it('commercial → 0', () => expect(getPhaseOrder('commercial')).toBe(0));
    it('deploiement → 1', () => expect(getPhaseOrder('deploiement')).toBe(1));
    it('production → 2', () => expect(getPhaseOrder('production')).toBe(2));
  });

  describe('GEO_PHASE_COLORS', () => {
    it('has 4 colors', () => expect(Object.keys(GEO_PHASE_COLORS).length).toBe(4));
    it('prospects is amber', () => expect(GEO_PHASE_COLORS.prospects).toBe('#f59e0b'));
    it('production is green', () => expect(GEO_PHASE_COLORS.production).toBe('#10b981'));
  });

  describe('getGeoPhaseFromStatus', () => {
    it('Prospect → prospects', () => expect(getGeoPhaseFromStatus('Prospect')).toBe('prospects'));
    it('Autre compte / GHT → prospects', () => expect(getGeoPhaseFromStatus('Autre compte / GHT')).toBe('prospects'));
    it('Contractuel → deploiement', () => expect(getGeoPhaseFromStatus('Contractuel')).toBe('deploiement'));
    it('Production → production', () => expect(getGeoPhaseFromStatus('Production')).toBe('production'));
    it('Refus → hors_pipeline', () => expect(getGeoPhaseFromStatus('Refus')).toBe('hors_pipeline'));
    it('Reporté → hors_pipeline', () => expect(getGeoPhaseFromStatus('Reporté')).toBe('hors_pipeline'));
    it('Unknown → prospects (fallback)', () => expect(getGeoPhaseFromStatus('Unknown')).toBe('prospects'));
  });
});
