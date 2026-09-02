import { describe, it, expect } from 'vitest';
import { formatCurrency, formatNumber, formatPercent } from '../formatters';

describe('formatters extended2', () => {
  describe('formatCurrency', () => {
    it('formats positive', () => {
      const result = formatCurrency(1234.56);
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).toContain('€');
    });
    it('formats zero', () => {
      const result = formatCurrency(0);
      expect(result).toContain('0');
      expect(result).toContain('€');
    });
    it('formats negative', () => {
      const result = formatCurrency(-500);
      expect(result).toContain('500');
      expect(result).toContain('€');
    });
    it('formats large numbers', () => {
      const result = formatCurrency(1000000);
      expect(result).toContain('1');
      expect(result).toContain('000');
    });
    it('formats decimals', () => {
      const result = formatCurrency(99.99);
      expect(result).toContain('99');
    });
    it('formats small amounts', () => {
      const result = formatCurrency(0.01);
      expect(result).toContain('0');
      expect(result).toContain('€');
    });
  });

  describe('formatNumber', () => {
    it('formats integer', () => {
      expect(formatNumber(1234)).toContain('1');
      expect(formatNumber(1234)).toContain('234');
    });
    it('formats zero', () => expect(formatNumber(0)).toBe('0'));
    it('formats negative', () => {
      const result = formatNumber(-1000);
      expect(result).toContain('1');
      expect(result).toContain('000');
    });
    it('formats large number', () => {
      const result = formatNumber(1000000);
      expect(result.replace(/\s/g, '').replace(/\u202f/g, '')).toContain('1000000');
    });
  });

  describe('formatPercent', () => {
    it('formats 0.5', () => {
      const result = formatPercent(0.5);
      expect(result).toContain('%');
    });
    it('formats 1', () => {
      const result = formatPercent(1);
      expect(result).toContain('%');
    });
    it('formats 0 as 0%', () => {
      const result = formatPercent(0);
      expect(result).toContain('0');
      expect(result).toContain('%');
    });
    it('result is a string', () => {
      expect(typeof formatPercent(0.75)).toBe('string');
    });
  });
});
