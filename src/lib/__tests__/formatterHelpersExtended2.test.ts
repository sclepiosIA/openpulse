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

describe('formatterHelpers (extended2)', () => {
  describe('formatPercentage', () => {
    it('default 1 decimal', () => expect(formatPercentage(75.123)).toBe('75.1%'));
    it('0 decimals', () => expect(formatPercentage(75.123, 0)).toBe('75%'));
    it('2 decimals', () => expect(formatPercentage(75.123, 2)).toBe('75.12%'));
  });

  describe('formatCompactNumber', () => {
    it('small number', () => expect(formatCompactNumber(500)).toBe('500'));
    it('thousands', () => expect(formatCompactNumber(1500)).toBe('1.5k'));
    it('millions', () => expect(formatCompactNumber(2500000)).toBe('2.5M'));
  });

  describe('formatDateFR', () => {
    it('short format', () => {
      const result = formatDateFR('2026-03-09', 'short');
      expect(result).toContain('09');
      expect(result).toContain('2026');
    });
    it('long format', () => {
      const result = formatDateFR('2026-03-09', 'long');
      expect(result).toContain('9');
      expect(result).toContain('2026');
    });
    it('accepts Date object', () => {
      const result = formatDateFR(new Date(2026, 2, 9));
      expect(result).toContain('09');
    });
  });

  describe('formatTime', () => {
    it('formats time', () => {
      const result = formatTime(new Date(2026, 2, 9, 14, 30));
      expect(result).toContain('14');
      expect(result).toContain('30');
    });
  });

  describe('formatDuration', () => {
    it('< 60 → minutes', () => expect(formatDuration(45)).toBe('45min'));
    it('exact hours', () => expect(formatDuration(120)).toBe('2h'));
    it('hours + minutes', () => expect(formatDuration(90)).toBe('1h30'));
    it('hours + padded minutes', () => expect(formatDuration(65)).toBe('1h05'));
  });

  describe('formatPhone', () => {
    it('French 10-digit', () => expect(formatPhone('0612345678')).toBe('06 12 34 56 78'));
    it('international', () => expect(formatPhone('33612345678')).toBe('+33 6 12 34 56 78'));
    it('passthrough unknown', () => expect(formatPhone('123')).toBe('123'));
  });

  describe('formatFileSizeFR', () => {
    it('bytes', () => expect(formatFileSizeFR(500)).toBe('500 o'));
    it('Ko', () => expect(formatFileSizeFR(2048)).toBe('2.0 Ko'));
    it('Mo', () => expect(formatFileSizeFR(5 * 1024 * 1024)).toBe('5.0 Mo'));
    it('Go', () => expect(formatFileSizeFR(2 * 1024 * 1024 * 1024)).toBe('2.0 Go'));
  });

  describe('truncate', () => {
    it('short text unchanged', () => expect(truncate('Hi', 10)).toBe('Hi'));
    it('long text truncated', () => expect(truncate('Hello World Test', 10)).toBe('Hello W...'));
    it('exact length unchanged', () => expect(truncate('12345', 5)).toBe('12345'));
  });

  describe('getInitials', () => {
    it('two words', () => expect(getInitials('Jean Dupont')).toBe('JD'));
    it('single word', () => expect(getInitials('Jean')).toBe('J'));
    it('three words → 2 chars', () => expect(getInitials('Jean Paul Dupont')).toBe('JP'));
  });

  describe('formatCurrencyCustom', () => {
    it('formats EUR', () => {
      const result = formatCurrencyCustom(1234.56);
      expect(result).toContain('1');
      expect(result).toContain('234');
    });
  });

  describe('formatNumberFR', () => {
    it('formats with FR locale', () => {
      const result = formatNumberFR(1234567);
      // FR format uses space or narrow no-break space as separator
      expect(result.replace(/\s/g, '')).toBe('1234567');
    });
  });
});
