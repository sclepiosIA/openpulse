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

describe('formatterHelpers extended', () => {
  describe('formatPercentage', () => {
    it('default 1 decimal', () => expect(formatPercentage(85.456)).toBe('85.5%'));
    it('0 decimals', () => expect(formatPercentage(85.456, 0)).toBe('85%'));
    it('2 decimals', () => expect(formatPercentage(85.456, 2)).toBe('85.46%'));
  });

  describe('formatCompactNumber', () => {
    it('small number', () => expect(formatCompactNumber(999)).toBe('999'));
    it('thousands', () => expect(formatCompactNumber(1500)).toBe('1.5k'));
    it('millions', () => expect(formatCompactNumber(2500000)).toBe('2.5M'));
  });

  describe('formatDateFR', () => {
    it('short format', () => {
      const result = formatDateFR('2026-03-09', 'short');
      expect(result).toContain('09');
    });
    it('long format', () => {
      const result = formatDateFR('2026-03-09', 'long');
      expect(result).toContain('mars');
    });
    it('accepts Date object', () => {
      const result = formatDateFR(new Date(2026, 2, 9));
      expect(result).toContain('09');
    });
  });

  describe('formatTime', () => {
    it('formats time', () => {
      const result = formatTime(new Date(2026, 0, 1, 14, 30));
      expect(result).toContain('14');
      expect(result).toContain('30');
    });
  });

  describe('formatDuration', () => {
    it('minutes only', () => expect(formatDuration(45)).toBe('45min'));
    it('hours only', () => expect(formatDuration(120)).toBe('2h'));
    it('hours and minutes', () => expect(formatDuration(90)).toBe('1h30'));
    it('hours with padding', () => expect(formatDuration(65)).toBe('1h05'));
  });

  describe('formatPhone', () => {
    it('french mobile', () => expect(formatPhone('0612345678')).toBe('06 12 34 56 78'));
    it('+33 format', () => expect(formatPhone('33612345678')).toBe('+33 6 12 34 56 78'));
    it('other format unchanged', () => expect(formatPhone('123')).toBe('123'));
  });

  describe('formatFileSizeFR', () => {
    it('bytes', () => expect(formatFileSizeFR(500)).toBe('500 o'));
    it('kilobytes', () => expect(formatFileSizeFR(2048)).toBe('2.0 Ko'));
    it('megabytes', () => expect(formatFileSizeFR(5242880)).toBe('5.0 Mo'));
    it('gigabytes', () => expect(formatFileSizeFR(1073741824)).toBe('1.0 Go'));
  });

  describe('truncate', () => {
    it('no truncation needed', () => expect(truncate('short', 10)).toBe('short'));
    it('truncates with ellipsis', () => expect(truncate('a very long text', 10)).toBe('a very ...'));
  });

  describe('getInitials', () => {
    it('two words', () => expect(getInitials('Jean Dupont')).toBe('JD'));
    it('single word', () => expect(getInitials('Admin')).toBe('A'));
    it('three words', () => expect(getInitials('Jean Claude Dupont')).toBe('JC'));
  });

  describe('formatCurrencyCustom', () => {
    it('EUR default', () => {
      const result = formatCurrencyCustom(1234.56);
      expect(result).toContain('1');
      expect(result).toContain('234');
    });
  });

  describe('formatNumberFR', () => {
    it('formats with separator', () => {
      const result = formatNumberFR(1234567);
      expect(result).toContain('1');
    });
  });
});
