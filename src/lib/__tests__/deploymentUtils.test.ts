import { describe, it, expect } from 'vitest';
import {
  getStatutColor,
  getStatutLabel,
  getHealthLabel,
  formatDateFr,
  DEPLOYMENT_PHASES,
  HEALTH_OPTIONS,
} from '../deploymentUtils';

describe('deploymentUtils', () => {
  describe('DEPLOYMENT_PHASES', () => {
    it('contains deployment statuses', () => {
      expect(DEPLOYMENT_PHASES).toContain('Contractuel');
      expect(DEPLOYMENT_PHASES).toContain('Go-Live');
    });
  });

  describe('HEALTH_OPTIONS', () => {
    it('has 4 options', () => {
      expect(HEALTH_OPTIONS).toHaveLength(4);
    });
  });

  describe('getStatutColor', () => {
    it('returns color classes for known status', () => {
      expect(getStatutColor('Contractuel')).toContain('primary');
    });
    it('returns muted for unknown', () => {
      expect(getStatutColor('Unknown')).toContain('muted');
    });
  });

  describe('getStatutLabel', () => {
    it('returns status text', () => {
      expect(getStatutLabel('Contractuel')).toBe('Contractuel');
    });
    it('returns Non défini for falsy', () => {
      expect(getStatutLabel('')).toBe('Non défini');
    });
  });

  describe('getHealthLabel', () => {
    it('returns label for known health', () => {
      expect(getHealthLabel('healthy')).toContain('Dans les temps');
    });
    it('returns raw for unknown', () => {
      expect(getHealthLabel('custom')).toBe('custom');
    });
  });

  describe('formatDateFr', () => {
    it('formats date string', () => {
      const result = formatDateFr('2025-03-15');
      expect(result).toContain('15');
    });
    it('returns dash for null', () => {
      expect(formatDateFr(null)).toBe('-');
    });
  });
});
