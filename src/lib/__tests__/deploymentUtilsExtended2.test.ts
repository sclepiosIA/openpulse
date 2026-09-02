import { describe, it, expect } from 'vitest';
import {
  DEPLOYMENT_PHASES,
  HEALTH_OPTIONS,
  getStatutColor,
  getStatutLabel,
  getHealthLabel,
  formatDateFr,
} from '../deploymentUtils';

describe('deploymentUtils (extended2)', () => {
  describe('DEPLOYMENT_PHASES', () => {
    it('has 7 phases', () => expect(DEPLOYMENT_PHASES.length).toBe(7));
    it('starts with Contractuel', () => expect(DEPLOYMENT_PHASES[0]).toBe('Contractuel'));
    it('ends with Go-Live', () => expect(DEPLOYMENT_PHASES[DEPLOYMENT_PHASES.length - 1]).toBe('Go-Live'));
  });

  describe('HEALTH_OPTIONS', () => {
    it('has 4 options', () => expect(HEALTH_OPTIONS.length).toBe(4));
    it('healthy option', () => expect(HEALTH_OPTIONS[0].value).toBe('healthy'));
    it('at-risk option', () => expect(HEALTH_OPTIONS[1].value).toBe('at-risk'));
    it('delayed option', () => expect(HEALTH_OPTIONS[2].value).toBe('delayed'));
    it('each has label and color', () => {
      HEALTH_OPTIONS.forEach(opt => {
        expect(opt.label).toBeTruthy();
        expect(opt.color).toContain('text-');
      });
    });
  });

  describe('getStatutColor', () => {
    it('Contractuel → primary', () => expect(getStatutColor('Contractuel')).toContain('primary'));
    it('Formation → accent', () => expect(getStatutColor('Formation')).toContain('accent'));
    it('Go-Live → success', () => expect(getStatutColor('Go-Live')).toContain('success'));
    it('unknown → muted', () => expect(getStatutColor('Unknown')).toContain('muted'));
  });

  describe('getStatutLabel', () => {
    it('returns statut', () => expect(getStatutLabel('Contractuel')).toBe('Contractuel'));
    it('empty → Non défini', () => expect(getStatutLabel('')).toBe('Non défini'));
  });

  describe('getHealthLabel', () => {
    it('healthy → label with emoji', () => expect(getHealthLabel('healthy')).toContain('Dans les temps'));
    it('at-risk → label', () => expect(getHealthLabel('at-risk')).toContain('risque'));
    it('unknown → passthrough', () => expect(getHealthLabel('custom')).toBe('custom'));
  });

  describe('formatDateFr', () => {
    it('formats date', () => {
      const result = formatDateFr('2026-03-09');
      expect(result).toContain('09');
      expect(result).toContain('03');
      expect(result).toContain('2026');
    });
    it('Date object', () => {
      const result = formatDateFr(new Date(2026, 2, 9));
      expect(result).toContain('2026');
    });
    it('null → -', () => expect(formatDateFr(null)).toBe('-'));
    it('undefined → -', () => expect(formatDateFr(undefined)).toBe('-'));
  });
});
