import { describe, it, expect } from 'vitest';
import {
  normalizeString,
  calculateDistance,
  getWorkloadColor,
  getPhaseColor,
  formatNumber,
  formatPercent,
} from '../geoUtils';

describe('geoUtils extended2', () => {
  describe('normalizeString edge cases', () => {
    it('removes accents', () => expect(normalizeString('Hôpital')).toBe('hopital'));
    it('removes special chars', () => expect(normalizeString('test@#$%')).toBe('test'));
    it('preserves numbers', () => expect(normalizeString('CH42')).toBe('ch42'));
    it('trims whitespace', () => expect(normalizeString('  test  ')).toBe('test'));
    it('handles empty', () => expect(normalizeString('')).toBe(''));
    it('handles accented capitals', () => expect(normalizeString('ÉÀÜÏÔ')).toBe('eauio'));
    it('preserves spaces between words', () => expect(normalizeString('Mon Hôpital')).toBe('mon hopital'));
  });

  describe('calculateDistance', () => {
    it('same point → 0', () => expect(calculateDistance(48.8, 2.3, 48.8, 2.3)).toBe(0));
    it('Paris-Lyon ≈ 392km', () => {
      const d = calculateDistance(48.8566, 2.3522, 45.7640, 4.8357);
      expect(d).toBeGreaterThan(380);
      expect(d).toBeLessThan(420);
    });
    it('Paris-Marseille ≈ 660km', () => {
      const d = calculateDistance(48.8566, 2.3522, 43.2965, 5.3698);
      expect(d).toBeGreaterThan(640);
      expect(d).toBeLessThan(680);
    });
    it('equator points', () => {
      const d = calculateDistance(0, 0, 0, 1);
      expect(d).toBeGreaterThan(110);
      expect(d).toBeLessThan(112);
    });
  });

  describe('getWorkloadColor', () => {
    it('0 → success', () => expect(getWorkloadColor(0)).toBe('hsl(var(--success))'));
    it('5 → success', () => expect(getWorkloadColor(5)).toBe('hsl(var(--success))'));
    it('6 → warning', () => expect(getWorkloadColor(6)).toBe('hsl(var(--warning))'));
    it('15 → warning', () => expect(getWorkloadColor(15)).toBe('hsl(var(--warning))'));
    it('16 → destructive', () => expect(getWorkloadColor(16)).toBe('hsl(var(--destructive))'));
    it('100 → destructive', () => expect(getWorkloadColor(100)).toBe('hsl(var(--destructive))'));
  });

  describe('getPhaseColor', () => {
    it('Prospects → chart-1', () => expect(getPhaseColor('Prospects')).toBe('hsl(var(--chart-1))'));
    it('Déploiement → chart-3', () => expect(getPhaseColor('Déploiement')).toBe('hsl(var(--chart-3))'));
    it('Production → chart-2', () => expect(getPhaseColor('Production')).toBe('hsl(var(--chart-2))'));
    it('unknown → muted', () => expect(getPhaseColor('Other')).toBe('hsl(var(--muted))'));
  });

  describe('formatNumber', () => {
    it('formats thousands', () => {
      const result = formatNumber(1234567);
      // fr-FR uses non-breaking space or narrow no-break space
      expect(result.replace(/\s/g, '')).toBe('1234567');
    });
    it('formats 0', () => expect(formatNumber(0)).toBe('0'));
    it('formats negative', () => expect(formatNumber(-42).replace(/\s/g, '')).toContain('42'));
  });

  describe('formatPercent', () => {
    it('rounds', () => expect(formatPercent(33.7)).toBe('34%'));
    it('zero', () => expect(formatPercent(0)).toBe('0%'));
    it('100', () => expect(formatPercent(100)).toBe('100%'));
    it('decimal < 1', () => expect(formatPercent(0.4)).toBe('0%'));
  });
});
