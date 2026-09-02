import { describe, it, expect } from 'vitest';
import {
  getHealthColor,
  getHealthBadgeColor,
  getHealthLabel,
  getHealthIcon,
  type CustomerHealthStatus,
} from '../crm/useCustomerHealth';

const allStatuses: CustomerHealthStatus[] = ['healthy', 'at-risk', 'churn-risk', 'critical', 'onboarding'];

describe('useCustomerHealth helpers', () => {
  describe('getHealthColor', () => {
    it('healthy → text-success', () => expect(getHealthColor('healthy')).toBe('text-success'));
    it('at-risk → text-warning', () => expect(getHealthColor('at-risk')).toBe('text-warning'));
    it('churn-risk → text-destructive', () => expect(getHealthColor('churn-risk')).toBe('text-destructive'));
    it('critical → text-destructive', () => expect(getHealthColor('critical')).toBe('text-destructive'));
    it('onboarding → text-primary', () => expect(getHealthColor('onboarding')).toBe('text-primary'));
    it('all statuses return a string', () => {
      allStatuses.forEach(s => expect(typeof getHealthColor(s)).toBe('string'));
    });
  });

  describe('getHealthBadgeColor', () => {
    it('healthy → contains bg-success', () => expect(getHealthBadgeColor('healthy')).toContain('bg-success'));
    it('at-risk → contains bg-warning', () => expect(getHealthBadgeColor('at-risk')).toContain('bg-warning'));
    it('churn-risk → contains bg-destructive', () => expect(getHealthBadgeColor('churn-risk')).toContain('bg-destructive'));
    it('critical → contains bg-destructive', () => expect(getHealthBadgeColor('critical')).toContain('bg-destructive'));
    it('onboarding → contains bg-primary', () => expect(getHealthBadgeColor('onboarding')).toContain('bg-primary'));
    it('all return multi-class strings', () => {
      allStatuses.forEach(s => expect(getHealthBadgeColor(s).split(' ').length).toBeGreaterThan(1));
    });
  });

  describe('getHealthLabel', () => {
    it('healthy → Bon', () => expect(getHealthLabel('healthy')).toBe('Bon'));
    it('at-risk → At Risk', () => expect(getHealthLabel('at-risk')).toBe('At Risk'));
    it('churn-risk → Churn Risk', () => expect(getHealthLabel('churn-risk')).toBe('Churn Risk'));
    it('critical → Critical', () => expect(getHealthLabel('critical')).toBe('Critical'));
    it('onboarding → Onboarding', () => expect(getHealthLabel('onboarding')).toBe('Onboarding'));
  });

  describe('getHealthIcon', () => {
    it('healthy → 🟢', () => expect(getHealthIcon('healthy')).toBe('🟢'));
    it('at-risk → 🟠', () => expect(getHealthIcon('at-risk')).toBe('🟠'));
    it('churn-risk → 🔴', () => expect(getHealthIcon('churn-risk')).toBe('🔴'));
    it('critical → 🚨', () => expect(getHealthIcon('critical')).toBe('🚨'));
    it('onboarding → 🆕', () => expect(getHealthIcon('onboarding')).toBe('🆕'));
    it('all return emoji', () => {
      allStatuses.forEach(s => expect(getHealthIcon(s).length).toBeGreaterThan(0));
    });
  });
});
