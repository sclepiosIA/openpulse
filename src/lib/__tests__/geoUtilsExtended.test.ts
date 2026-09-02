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
  describe('normalizeString', () => {
    it('lowercases', () => expect(normalizeString('ABC')).toBe('abc'));
    it('removes accents', () => expect(normalizeString('éàü')).toBe('eau'));
    it('removes special chars', () => expect(normalizeString('hello-world!')).toBe('helloworld'));
    it('trims', () => expect(normalizeString('  hi  ')).toBe('hi'));
    it('preserves spaces', () => expect(normalizeString('a b')).toBe('a b'));
  });

  describe('calculateDistance', () => {
    it('returns 0 for same point', () => {
      expect(calculateDistance(48.8566, 2.3522, 48.8566, 2.3522)).toBe(0);
    });
    it('calculates Paris to Lyon (~392km)', () => {
      const dist = calculateDistance(48.8566, 2.3522, 45.764, 4.8357);
      expect(dist).toBeGreaterThan(380);
      expect(dist).toBeLessThan(410);
    });
    it('calculates Paris to Marseille (~660km)', () => {
      const dist = calculateDistance(48.8566, 2.3522, 43.2965, 5.3698);
      expect(dist).toBeGreaterThan(640);
      expect(dist).toBeLessThan(680);
    });
  });

  describe('getWorkloadColor', () => {
    it('≤5 → success', () => expect(getWorkloadColor(3)).toContain('success'));
    it('≤15 → warning', () => expect(getWorkloadColor(10)).toContain('warning'));
    it('>15 → destructive', () => expect(getWorkloadColor(20)).toContain('destructive'));
  });

  describe('getPhaseColor', () => {
    it('Prospects → chart-1', () => expect(getPhaseColor('Prospects')).toContain('chart-1'));
    it('Déploiement → chart-3', () => expect(getPhaseColor('Déploiement')).toContain('chart-3'));
    it('Production → chart-2', () => expect(getPhaseColor('Production')).toContain('chart-2'));
    it('unknown → muted', () => expect(getPhaseColor('Other')).toContain('muted'));
  });

  describe('formatNumber', () => {
    it('formats with FR locale', () => {
      const result = formatNumber(1234567);
      expect(result.replace(/\s/g, '')).toBe('1234567');
    });
  });

  describe('formatPercent', () => {
    it('rounds and appends %', () => expect(formatPercent(85.7)).toBe('86%'));
    it('handles 0', () => expect(formatPercent(0)).toBe('0%'));
  });
});
