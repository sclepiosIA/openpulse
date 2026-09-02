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

describe('formatterHelpers - extended', () => {
  describe('formatPercentage', () => {
    it('formats with default decimals', () => expect(formatPercentage(85.67)).toBe('85.7%'));
    it('formats with 0 decimals', () => expect(formatPercentage(85.67, 0)).toBe('86%'));
  });

  describe('formatCompactNumber', () => {
    it('returns raw for small numbers', () => expect(formatCompactNumber(500)).toBe('500'));
    it('formats thousands', () => expect(formatCompactNumber(1500)).toBe('1.5k'));
    it('formats millions', () => expect(formatCompactNumber(2500000)).toBe('2.5M'));
  });

  describe('formatDateFR', () => {
    it('formats short date', () => {
      const result = formatDateFR('2026-03-09', 'short');
      expect(result).toContain('09');
    });
    it('formats long date', () => {
      const result = formatDateFR('2026-03-09', 'long');
      expect(result).toContain('2026');
      expect(result.toLowerCase()).toContain('mars');
    });
    it('handles Date object', () => {
      const result = formatDateFR(new Date(2026, 2, 9));
      expect(result).toContain('09');
    });
  });

  describe('formatTime', () => {
    it('formats time from string', () => {
      const result = formatTime('2026-03-09T14:30:00');
      expect(result).toContain('14');
      expect(result).toContain('30');
    });
  });

  describe('formatDuration', () => {
    it('formats minutes only', () => expect(formatDuration(45)).toBe('45min'));
    it('formats hours only', () => expect(formatDuration(120)).toBe('2h'));
    it('formats hours and minutes', () => expect(formatDuration(90)).toBe('1h30'));
    it('formats hours with padded minutes', () => expect(formatDuration(65)).toBe('1h05'));
  });

  describe('formatPhone', () => {
    it('formats French mobile', () => {
      expect(formatPhone('0612345678')).toBe('06 12 34 56 78');
    });
    it('formats +33 number', () => {
      const result = formatPhone('+33612345678');
      expect(result).toContain('+33');
    });
    it('returns raw for unknown format', () => {
      expect(formatPhone('123')).toBe('123');
    });
  });

  describe('formatFileSizeFR', () => {
    it('formats bytes', () => expect(formatFileSizeFR(500)).toBe('500 o'));
    it('formats Ko', () => expect(formatFileSizeFR(2048)).toBe('2.0 Ko'));
    it('formats Mo', () => expect(formatFileSizeFR(1048576)).toBe('1.0 Mo'));
    it('formats Go', () => expect(formatFileSizeFR(1073741824)).toBe('1.0 Go'));
  });

  describe('truncate', () => {
    it('returns short text unchanged', () => expect(truncate('Hi', 10)).toBe('Hi'));
    it('truncates long text with ...', () => expect(truncate('Hello World!', 8)).toBe('Hello...'));
  });

  describe('getInitials', () => {
    it('returns initials', () => expect(getInitials('Jean Dupont')).toBe('JD'));
    it('limits to 2 chars', () => expect(getInitials('Jean Pierre Dupont')).toBe('JP'));
    it('handles single name', () => expect(getInitials('Admin')).toBe('A'));
  });

  describe('formatCurrencyCustom', () => {
    it('formats EUR by default', () => {
      const result = formatCurrencyCustom(1234.56);
      expect(result).toContain('1');
      expect(result).toContain('234');
    });
  });

  describe('formatNumberFR', () => {
    it('formats with French locale', () => {
      const result = formatNumberFR(1234567);
      // French uses non-breaking space as thousands separator
      expect(result.replace(/\s/g, '')).toBe('1234567');
    });
  });
});
