import { describe, it, expect } from 'vitest';
import {
  formatPercentage,
  formatCompactNumber,
  formatDateFR,
  formatTime,
  formatDuration,
  formatPhone,
  formatFileSizeFR,
  truncate,
  getInitials,
  formatCurrencyCustom,
  formatNumberFR,
} from '../formatterHelpers';

describe('formatterHelpers extended4', () => {
  describe('formatPercentage', () => {
    it('default 1 decimal', () => expect(formatPercentage(33.33)).toBe('33.3%'));
    it('0 decimals', () => expect(formatPercentage(33.7, 0)).toBe('34%'));
    it('2 decimals', () => expect(formatPercentage(33.333, 2)).toBe('33.33%'));
    it('zero', () => expect(formatPercentage(0)).toBe('0.0%'));
    it('100', () => expect(formatPercentage(100)).toBe('100.0%'));
  });

  describe('formatCompactNumber', () => {
    it('< 1000 → raw', () => expect(formatCompactNumber(999)).toBe('999'));
    it('1000 → 1.0k', () => expect(formatCompactNumber(1000)).toBe('1.0k'));
    it('1500 → 1.5k', () => expect(formatCompactNumber(1500)).toBe('1.5k'));
    it('1M → 1.0M', () => expect(formatCompactNumber(1000000)).toBe('1.0M'));
    it('2.5M', () => expect(formatCompactNumber(2500000)).toBe('2.5M'));
  });

  describe('formatDateFR', () => {
    it('short format', () => {
      const result = formatDateFR('2026-03-09', 'short');
      expect(result).toContain('2026');
    });
    it('long format', () => {
      const result = formatDateFR('2026-03-09', 'long');
      expect(result).toContain('mars');
    });
    it('Date object', () => {
      const result = formatDateFR(new Date(2026, 0, 15), 'long');
      expect(result).toContain('janvier');
    });
  });

  describe('formatTime', () => {
    it('formats hours and minutes', () => {
      const result = formatTime(new Date(2026, 2, 9, 14, 30));
      expect(result).toBe('14:30');
    });
    it('string input', () => {
      const result = formatTime('2026-03-09T08:05:00');
      expect(result).toBe('08:05');
    });
  });

  describe('formatDuration', () => {
    it('< 60min → min', () => expect(formatDuration(45)).toBe('45min'));
    it('60min → 1h', () => expect(formatDuration(60)).toBe('1h'));
    it('90min → 1h30', () => expect(formatDuration(90)).toBe('1h30'));
    it('120min → 2h', () => expect(formatDuration(120)).toBe('2h'));
  });

  describe('formatPhone', () => {
    it('French number with spaces', () => {
      const result = formatPhone('0612345678');
      expect(result).toBe('06 12 34 56 78');
    });
    it('+33 format', () => {
      const result = formatPhone('+33612345678');
      expect(result).toBe('+33 6 12 34 56 78');
    });
    it('33 prefix', () => {
      const result = formatPhone('33612345678');
      expect(result).toBe('+33 6 12 34 56 78');
    });
  });

  describe('formatFileSizeFR', () => {
    it('bytes', () => expect(formatFileSizeFR(500)).toBe('500 o'));
    it('Ko', () => expect(formatFileSizeFR(2048)).toBe('2.0 Ko'));
    it('Mo', () => expect(formatFileSizeFR(1048576)).toBe('1.0 Mo'));
    it('Go', () => expect(formatFileSizeFR(1073741824)).toBe('1.0 Go'));
  });

  describe('truncate', () => {
    it('short text unchanged', () => expect(truncate('hello', 10)).toBe('hello'));
    it('long text truncated', () => expect(truncate('hello world', 8)).toBe('hello...'));
    it('exact length unchanged', () => expect(truncate('hello', 5)).toBe('hello'));
  });

  describe('getInitials', () => {
    it('two words', () => expect(getInitials('Jean Dupont')).toBe('JD'));
    it('three words → first two', () => expect(getInitials('Jean Claude Dupont')).toBe('JC'));
    it('single word', () => expect(getInitials('Jean')).toBe('J'));
    it('lowercase', () => expect(getInitials('jean dupont')).toBe('JD'));
  });

  describe('formatCurrencyCustom', () => {
    it('EUR default', () => {
      const result = formatCurrencyCustom(1234.5);
      expect(result).toContain('€');
    });
    it('USD', () => {
      const result = formatCurrencyCustom(1234.5, 'USD');
      expect(result).toContain('$');
    });
  });

  describe('formatNumberFR', () => {
    it('formats with separator', () => {
      const result = formatNumberFR(1234567);
      expect(result.replace(/\s/g, '')).toBe('1234567');
    });
    it('zero', () => expect(formatNumberFR(0)).toBe('0'));
  });
});
