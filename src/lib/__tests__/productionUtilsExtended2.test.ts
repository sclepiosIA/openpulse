import { describe, it, expect } from 'vitest';
import {
  HEALTH_LABELS_FR,
  PRODUCTION_STATUSES,
  HEALTH_OPTIONS,
  DURATION_OPTIONS,
  ADOPTION_OPTIONS,
  NPS_OPTIONS,
  SUPPORT_OPTIONS,
  RENEWAL_OPTIONS,
} from '../productionUtils';

describe('productionUtils (extended2)', () => {
  describe('HEALTH_LABELS_FR', () => {
    it('healthy', () => expect(HEALTH_LABELS_FR['healthy']).toBe('En bonne santé'));
    it('at-risk', () => expect(HEALTH_LABELS_FR['at-risk']).toBe('À risque'));
    it('churn-risk', () => expect(HEALTH_LABELS_FR['churn-risk']).toBe('Risque de churn'));
    it('onboarding', () => expect(HEALTH_LABELS_FR['onboarding']).toBe('Onboarding'));
  });

  describe('PRODUCTION_STATUSES', () => {
    it('contains Production', () => expect(PRODUCTION_STATUSES).toContain('Production'));
  });

  describe('HEALTH_OPTIONS', () => {
    it('has 4 options', () => expect(HEALTH_OPTIONS.length).toBe(4));
    it('each has value/label/icon', () => {
      HEALTH_OPTIONS.forEach(opt => {
        expect(opt.value).toBeDefined();
        expect(opt.label).toBeDefined();
        expect(opt.icon).toBeDefined();
      });
    });
  });

  describe('DURATION_OPTIONS', () => {
    it('has 5 options', () => expect(DURATION_OPTIONS.length).toBe(5));
    it('includes 0-3 months', () => expect(DURATION_OPTIONS[0].value).toBe('0-3'));
  });

  describe('ADOPTION_OPTIONS', () => {
    it('has 3 options', () => expect(ADOPTION_OPTIONS.length).toBe(3));
  });

  describe('NPS_OPTIONS', () => {
    it('has 3 options', () => expect(NPS_OPTIONS.length).toBe(3));
    it('detractors first', () => expect(NPS_OPTIONS[0].value).toBe('detractors'));
  });

  describe('SUPPORT_OPTIONS', () => {
    it('has 3 options', () => expect(SUPPORT_OPTIONS.length).toBe(3));
  });

  describe('RENEWAL_OPTIONS', () => {
    it('has 4 options', () => expect(RENEWAL_OPTIONS.length).toBe(4));
    it('includes expired', () => expect(RENEWAL_OPTIONS[3].value).toBe('expired'));
  });
});
