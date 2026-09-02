import { describe, it, expect } from 'vitest';
import {
  getHealthLabelFr,
  formatCurrency,
  formatDateFr,
  getMonthsInProduction,
  getRenewalInfo,
} from '../productionUtils';

describe('productionUtils functions', () => {
  describe('getHealthLabelFr', () => {
    it('healthy', () => expect(getHealthLabelFr('healthy')).toBe('En bonne santé'));
    it('at-risk', () => expect(getHealthLabelFr('at-risk')).toBe('À risque'));
    it('churn-risk', () => expect(getHealthLabelFr('churn-risk')).toBe('Risque de churn'));
    it('onboarding', () => expect(getHealthLabelFr('onboarding')).toBe('Onboarding'));
    it('unknown → passthrough', () => expect(getHealthLabelFr('custom')).toBe('custom'));
  });

  describe('formatCurrency', () => {
    it('formats positive amount', () => {
      const result = formatCurrency(1234.56);
      expect(result).toContain('1');
      expect(result).toContain('235'); // fr-FR rounds and groups: 1 235
    });
    it('formats zero', () => {
      const result = formatCurrency(0);
      expect(result).toContain('0');
    });
    it('formats negative', () => {
      const result = formatCurrency(-500);
      expect(result).toContain('500');
    });
  });

  describe('formatDateFr', () => {
    it('formats valid date string', () => {
      const result = formatDateFr('2026-03-09');
      expect(result).toMatch(/mars|03/);
    });
    it('formats Date object', () => {
      const result = formatDateFr(new Date(2026, 2, 9));
      expect(result).toBeTruthy();
      expect(result).not.toBe('Non renseignée');
    });
    it('returns Non renseignée for undefined', () => {
      expect(formatDateFr(undefined)).toBe('Non renseignée');
    });
  });

  describe('getMonthsInProduction', () => {
    it('returns 0 for undefined', () => expect(getMonthsInProduction(undefined)).toBe(0));
    it('returns positive for past date', () => {
      const pastDate = new Date();
      pastDate.setMonth(pastDate.getMonth() - 6);
      expect(getMonthsInProduction(pastDate)).toBeGreaterThanOrEqual(5);
    });
    it('returns 0 for future date', () => {
      expect(getMonthsInProduction('2099-01-01')).toBe(0);
    });
    it('accepts string date', () => {
      const pastDate = new Date();
      pastDate.setMonth(pastDate.getMonth() - 12);
      expect(getMonthsInProduction(pastDate.toISOString())).toBeGreaterThanOrEqual(11);
    });
  });

  describe('getRenewalInfo', () => {
    it('returns null for undefined', () => expect(getRenewalInfo(undefined)).toBeNull());

    it('returns expired for past date', () => {
      const result = getRenewalInfo('2020-01-01');
      expect(result).not.toBeNull();
      expect(result!.label).toBe('Expiré');
      expect(result!.alert).toBe(true);
      expect(result!.days).toBeLessThan(0);
    });

    it('returns alert for < 30 days', () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 15);
      const result = getRenewalInfo(soon.toISOString().split('T')[0]);
      expect(result).not.toBeNull();
      expect(result!.alert).toBe(true);
      expect(result!.label).toContain('jours');
    });

    it('returns alert for 30-90 days', () => {
      const medium = new Date();
      medium.setDate(medium.getDate() + 60);
      const result = getRenewalInfo(medium.toISOString().split('T')[0]);
      expect(result).not.toBeNull();
      expect(result!.alert).toBe(true);
      expect(result!.label).toContain('mois');
    });

    it('returns null for > 90 days', () => {
      const far = new Date();
      far.setDate(far.getDate() + 180);
      expect(getRenewalInfo(far.toISOString().split('T')[0])).toBeNull();
    });
  });
});
