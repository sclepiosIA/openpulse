import { describe, it, expect } from 'vitest';
import {
  HEALTH_LABELS_FR,
  HEALTH_OPTIONS,
  DURATION_OPTIONS,
  ADOPTION_OPTIONS,
  NPS_OPTIONS,
  SUPPORT_OPTIONS,
  RENEWAL_OPTIONS,
  PRODUCTION_STATUSES,
  getHealthLabelFr,
  formatCurrency,
  formatDateFr,
  getMonthsInProduction,
  getRenewalInfo,
} from '../productionUtils';

describe('productionUtils — constants', () => {
  it('exposes expected option arrays with stable shape', () => {
    expect(PRODUCTION_STATUSES).toEqual(['Production']);
    expect(HEALTH_OPTIONS).toHaveLength(4);
    expect(DURATION_OPTIONS).toHaveLength(5);
    expect(ADOPTION_OPTIONS).toHaveLength(3);
    expect(NPS_OPTIONS).toHaveLength(3);
    expect(SUPPORT_OPTIONS).toHaveLength(3);
    expect(RENEWAL_OPTIONS).toHaveLength(4);
    // every option has value+label
    for (const opt of [...HEALTH_OPTIONS, ...DURATION_OPTIONS, ...ADOPTION_OPTIONS, ...NPS_OPTIONS, ...SUPPORT_OPTIONS, ...RENEWAL_OPTIONS]) {
      expect(opt.value).toBeTruthy();
      expect(opt.label).toBeTruthy();
    }
  });
  it('HEALTH_LABELS_FR covers all health statuses', () => {
    expect(HEALTH_LABELS_FR['healthy']).toBe('En bonne santé');
    expect(HEALTH_LABELS_FR['at-risk']).toBe('À risque');
    expect(HEALTH_LABELS_FR['churn-risk']).toBe('Risque de churn');
    expect(HEALTH_LABELS_FR['onboarding']).toBe('Onboarding');
  });
});

describe('getHealthLabelFr', () => {
  it('returns FR label or status if unknown', () => {
    expect(getHealthLabelFr('healthy')).toBe('En bonne santé');
    expect(getHealthLabelFr('unknown-status')).toBe('unknown-status');
  });
});

describe('formatCurrency / formatDateFr', () => {
  it('formatCurrency in EUR with 0 fraction', () => {
    expect(formatCurrency(1000)).toMatch(/1\s?000.*€/);
    expect(formatCurrency(0)).toMatch(/0.*€/);
  });
  it('formatDateFr handles undefined', () => {
    expect(formatDateFr(undefined)).toBe('Non renseignée');
    expect(formatDateFr('2026-06-07')).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(formatDateFr(new Date('2026-06-07'))).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

describe('getMonthsInProduction', () => {
  it('returns 0 if no date', () => {
    expect(getMonthsInProduction(undefined)).toBe(0);
  });
  it('returns positive months for past date', () => {
    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
    expect(getMonthsInProduction(sixMonthsAgo)).toBeGreaterThanOrEqual(5);
    expect(getMonthsInProduction(sixMonthsAgo)).toBeLessThanOrEqual(7);
  });
  it('returns 0 for future date', () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    expect(getMonthsInProduction(future)).toBe(0);
  });
});

describe('getRenewalInfo', () => {
  const day = 24 * 60 * 60 * 1000;
  const inDays = (n: number) => new Date(Date.now() + n * day).toISOString();

  it('returns null without date or beyond 90 days', () => {
    expect(getRenewalInfo(undefined)).toBeNull();
    expect(getRenewalInfo(inDays(180))).toBeNull();
  });
  it('flags expired contracts', () => {
    const r = getRenewalInfo(inDays(-5))!;
    expect(r.alert).toBe(true);
    expect(r.label).toBe('Expiré');
    expect(r.days).toBeLessThan(0);
  });
  it('flags within 30 days', () => {
    const r = getRenewalInfo(inDays(15))!;
    expect(r.alert).toBe(true);
    expect(r.label).toMatch(/Dans \d+ jours/);
  });
  it('flags within 90 days (months label)', () => {
    const r = getRenewalInfo(inDays(60))!;
    expect(r.alert).toBe(true);
    expect(r.label).toMatch(/Dans \d+ mois/);
  });
});
