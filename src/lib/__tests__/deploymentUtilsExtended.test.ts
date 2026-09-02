import { describe, it, expect } from 'vitest';
import {
  getStatutColor,
  getStatutLabel,
  getHealthLabel,
  formatDateFr,
  HEALTH_OPTIONS,
} from '../deploymentUtils';

describe('deploymentUtils', () => {
  describe('getStatutColor', () => {
    it('Contractuel → primary', () => expect(getStatutColor('Contractuel')).toContain('primary'));
    it('Conformité → warning', () => expect(getStatutColor('Conformité')).toContain('warning'));
    it('Formation → accent', () => expect(getStatutColor('Formation')).toContain('accent'));
    it('Go-Live → success', () => expect(getStatutColor('Go-Live')).toContain('success'));
    it('unknown → muted', () => expect(getStatutColor('Autre')).toContain('muted'));
  });

  describe('getStatutLabel', () => {
    it('returns statut', () => expect(getStatutLabel('Formation')).toBe('Formation'));
    it('returns Non défini for empty', () => expect(getStatutLabel('')).toBe('Non défini'));
  });

  describe('getHealthLabel', () => {
    it('returns label for healthy', () => expect(getHealthLabel('healthy')).toContain('Dans les temps'));
    it('returns label for at-risk', () => expect(getHealthLabel('at-risk')).toContain('risque'));
    it('returns label for delayed', () => expect(getHealthLabel('delayed')).toContain('retard'));
    it('returns label for blocked', () => expect(getHealthLabel('blocked')).toContain('Bloqué'));
    it('returns raw for unknown', () => expect(getHealthLabel('custom')).toBe('custom'));
  });

  describe('formatDateFr', () => {
    it('formats date', () => {
      const result = formatDateFr('2026-03-09');
      expect(result).toContain('09');
    });
    it('returns - for null', () => expect(formatDateFr(null)).toBe('-'));
    it('returns - for undefined', () => expect(formatDateFr(undefined)).toBe('-'));
  });

  describe('HEALTH_OPTIONS', () => {
    it('has 4 options', () => expect(HEALTH_OPTIONS.length).toBe(4));
  });
});
