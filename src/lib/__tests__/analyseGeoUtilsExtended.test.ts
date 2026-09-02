import { describe, it, expect } from 'vitest';
import { formatDateFr, formatCurrency, PHASE_LABELS_FR, DEFAULT_GEO_FILTERS } from '../analyseGeoUtils';

describe('analyseGeoUtils', () => {
  describe('formatDateFr', () => {
    it('formats date string', () => {
      const result = formatDateFr('2026-03-09');
      expect(result).toContain('09');
      expect(result).toContain('03');
      expect(result).toContain('2026');
    });
    it('returns N/A for null', () => expect(formatDateFr(null)).toBe('N/A'));
    it('returns N/A for undefined', () => expect(formatDateFr(undefined)).toBe('N/A'));
    it('handles Date object', () => {
      const result = formatDateFr(new Date(2026, 2, 9));
      expect(result).toContain('09');
    });
  });

  describe('formatCurrency', () => {
    it('formats amount in EUR', () => {
      const result = formatCurrency(1500);
      expect(result).toContain('1');
      expect(result).toContain('500');
      expect(result).toContain('€');
    });
    it('returns N/A for null', () => expect(formatCurrency(null)).toBe('N/A'));
    it('returns N/A for undefined', () => expect(formatCurrency(undefined)).toBe('N/A'));
    it('handles 0', () => {
      const result = formatCurrency(0);
      expect(result).toContain('0');
      expect(result).toContain('€');
    });
  });

  describe('PHASE_LABELS_FR', () => {
    it('has all phases', () => {
      expect(PHASE_LABELS_FR.all).toBe('Tous');
      expect(PHASE_LABELS_FR.prospects).toBe('Prospects');
      expect(PHASE_LABELS_FR.deploiement).toBe('Déploiement');
      expect(PHASE_LABELS_FR.production).toBe('Production');
    });
  });

  describe('DEFAULT_GEO_FILTERS', () => {
    it('has empty defaults', () => {
      expect(DEFAULT_GEO_FILTERS.search).toBe('');
      expect(DEFAULT_GEO_FILTERS.regions).toEqual([]);
      expect(DEFAULT_GEO_FILTERS.types).toEqual([]);
      expect(DEFAULT_GEO_FILTERS.phases).toEqual([]);
      expect(DEFAULT_GEO_FILTERS.dpis).toEqual([]);
    });
  });
});
