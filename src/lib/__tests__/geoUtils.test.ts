import { describe, it, expect } from 'vitest';
import {
  normalizeString,
  calculateDistance,
  getWorkloadColor,
  getPhaseColor,
  formatNumber,
  formatPercent,
} from '../geoUtils';

describe('geoUtils', () => {
  it('normalizeString removes diacritics, punctuation, lowercases', () => {
    expect(normalizeString('Élève À l\'école!')).toBe('eleve a lecole');
    expect(normalizeString('  Hello  ')).toBe('hello');
  });

  it('calculateDistance returns 0 for same point', () => {
    expect(calculateDistance(48.85, 2.35, 48.85, 2.35)).toBeCloseTo(0, 5);
  });

  it('calculateDistance Paris→Lyon ~390km', () => {
    const d = calculateDistance(48.8566, 2.3522, 45.7640, 4.8357);
    expect(d).toBeGreaterThan(380);
    expect(d).toBeLessThan(410);
  });

  it('getWorkloadColor tiers', () => {
    expect(getWorkloadColor(3)).toContain('success');
    expect(getWorkloadColor(10)).toContain('warning');
    expect(getWorkloadColor(20)).toContain('destructive');
  });

  it('getPhaseColor switch', () => {
    expect(getPhaseColor('Prospects')).toContain('chart-1');
    expect(getPhaseColor('Déploiement')).toContain('chart-3');
    expect(getPhaseColor('Production')).toContain('chart-2');
    expect(getPhaseColor('Unknown')).toContain('muted');
  });

  it('formatNumber + formatPercent', () => {
    expect(formatNumber(1234)).toMatch(/1\s?234/);
    expect(formatPercent(33.7)).toBe('34%');
  });
});
