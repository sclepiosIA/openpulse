import { describe, it, expect } from 'vitest';
import {
  getHealthLabelFr,
  formatCurrency,
  formatDateFr,
  getMonthsInProduction,
  getRenewalInfo,
  HEALTH_OPTIONS,
  DURATION_OPTIONS,
  ADOPTION_OPTIONS,
  NPS_OPTIONS,
} from '../productionUtils';

describe('productionUtils', () => {
  describe('getHealthLabelFr', () => {
    it('returns french label for healthy', () => {
      expect(getHealthLabelFr('healthy')).toBe('En bonne santé');
    });
    it('returns french label for at-risk', () => {
      expect(getHealthLabelFr('at-risk')).toBe('À risque');
    });
    it('returns raw for unknown', () => {
      expect(getHealthLabelFr('custom')).toBe('custom');
    });
  });

  describe('formatCurrency', () => {
    it('formats EUR amounts', () => {
      const result = formatCurrency(1500);
      expect(result).toContain('1');
      expect(result).toContain('500');
    });
    it('handles zero', () => {
      expect(formatCurrency(0)).toContain('0');
    });
  });

  describe('formatDateFr', () => {
    it('formats date string', () => {
      const result = formatDateFr('2026-03-09');
      expect(result).toContain('09');
      expect(result).toContain('03');
      expect(result).toContain('2026');
    });
    it('returns "Non renseignée" for undefined', () => {
      expect(formatDateFr(undefined)).toBe('Non renseignée');
    });
    it('handles Date object', () => {
      const result = formatDateFr(new Date(2026, 0, 15));
      expect(result).toContain('15');
    });
  });

  describe('getMonthsInProduction', () => {
    it('returns 0 for undefined', () => {
      expect(getMonthsInProduction(undefined)).toBe(0);
    });
    it('returns positive for past date', () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      expect(getMonthsInProduction(twoYearsAgo.toISOString())).toBeGreaterThanOrEqual(23);
    });
    it('returns 0 for future date', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      expect(getMonthsInProduction(future.toISOString())).toBe(0);
    });
  });

  describe('getRenewalInfo', () => {
    it('returns null for undefined', () => {
      expect(getRenewalInfo(undefined)).toBeNull();
    });
    it('returns alert for expired contract', () => {
      const past = new Date();
      past.setDate(past.getDate() - 10);
      const info = getRenewalInfo(past.toISOString());
      expect(info).not.toBeNull();
      expect(info!.label).toBe('Expiré');
      expect(info!.alert).toBe(true);
    });
    it('returns alert for contract ending in 15 days', () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 15);
      const info = getRenewalInfo(soon.toISOString());
      expect(info).not.toBeNull();
      expect(info!.alert).toBe(true);
      expect(info!.label).toContain('jours');
    });
    it('returns alert for contract ending in 60 days', () => {
      const medium = new Date();
      medium.setDate(medium.getDate() + 60);
      const info = getRenewalInfo(medium.toISOString());
      expect(info).not.toBeNull();
      expect(info!.alert).toBe(true);
      expect(info!.label).toContain('mois');
    });
    it('returns null for contract ending in 6 months', () => {
      const far = new Date();
      far.setDate(far.getDate() + 180);
      expect(getRenewalInfo(far.toISOString())).toBeNull();
    });
  });

  describe('constants', () => {
    it('HEALTH_OPTIONS has 4 entries', () => expect(HEALTH_OPTIONS.length).toBe(4));
    it('DURATION_OPTIONS has 5 entries', () => expect(DURATION_OPTIONS.length).toBe(5));
    it('ADOPTION_OPTIONS has 3 entries', () => expect(ADOPTION_OPTIONS.length).toBe(3));
    it('NPS_OPTIONS has 3 entries', () => expect(NPS_OPTIONS.length).toBe(3));
  });
});
