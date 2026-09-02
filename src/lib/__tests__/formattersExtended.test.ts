import { describe, it, expect } from 'vitest';
import { formatCurrency, formatNumber, formatPercent } from '../formatters';

describe('formatters', () => {
  describe('formatCurrency', () => {
    it('formats EUR', () => {
      const result = formatCurrency(1500.50);
      expect(result).toContain('1');
      expect(result).toContain('500');
      expect(result).toContain('€');
    });
    it('formats 0', () => expect(formatCurrency(0)).toContain('0'));
    it('formats negative', () => expect(formatCurrency(-500)).toContain('500'));
  });

  describe('formatNumber', () => {
    it('formats with FR locale', () => {
      const result = formatNumber(123456);
      // FR uses non-breaking space as thousands separator
      expect(result.replace(/\s/g, '')).toBe('123456');
    });
    it('formats 0', () => expect(formatNumber(0)).toBe('0'));
  });

  describe('formatPercent', () => {
    it('formats 85 as 85%', () => {
      const result = formatPercent(85);
      expect(result).toContain('85');
      expect(result).toContain('%');
    });
    it('formats 0', () => expect(formatPercent(0)).toContain('0'));
    it('formats decimal', () => {
      const result = formatPercent(33.33);
      expect(result).toContain('33');
    });
  });
});
