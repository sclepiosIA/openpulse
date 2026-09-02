import { describe, it, expect } from 'vitest';
import {
  safeNum,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatPercentage,
  formatCompactNumber,
  formatDateFR,
  formatTime,
  toSafeDate,
  formatDuration,
  formatPhone,
  formatFileSizeFR,
  truncate,
  getInitials,
  formatCurrencyCustom,
  formatNumberFR,
} from '../formatters';

describe('formatters', () => {
  it('safeNum handles null/undefined/NaN/strings', () => {
    expect(safeNum(null)).toBe(0);
    expect(safeNum(undefined)).toBe(0);
    expect(safeNum('abc')).toBe(0);
    expect(safeNum('12.5')).toBe(12.5);
    expect(safeNum(42)).toBe(42);
    expect(safeNum(null, 5)).toBe(5);
  });

  it('formatCurrency handles null', () => {
    expect(formatCurrency(null)).toMatch(/0,00/);
    expect(formatCurrency(1000)).toMatch(/1\s?000,00/);
  });

  it('formatNumber + formatNumberFR', () => {
    expect(formatNumber(1234)).toMatch(/1\s?234/);
    expect(formatNumberFR(1234)).toMatch(/1\s?234/);
  });

  it('formatPercent', () => {
    expect(formatPercent(50)).toMatch(/50/);
  });

  it('formatPercentage with decimals', () => {
    expect(formatPercentage(33.333, 1)).toBe('33.3%');
    expect(formatPercentage(null)).toBe('0.0%');
  });

  it('formatCompactNumber', () => {
    expect(formatCompactNumber(500)).toBe('500');
    expect(formatCompactNumber(1500)).toBe('1.5k');
    expect(formatCompactNumber(2500000)).toBe('2.5M');
  });

  it('formatDateFR short/long', () => {
    const d = new Date('2024-03-15T12:00:00Z');
    expect(formatDateFR(d, 'short')).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(formatDateFR('2024-03-15', 'long')).toMatch(/mars/);
  });

  it('formatTime', () => {
    expect(formatTime(new Date('2024-03-15T08:30:00'))).toMatch(/\d{2}:\d{2}/);
  });

  it('toSafeDate', () => {
    expect(toSafeDate(null)).toBeNull();
    expect(toSafeDate('invalid')).toBeNull();
    expect(toSafeDate('2024-01-01')).toBeInstanceOf(Date);
    expect(toSafeDate(new Date('2024-01-01'))).toBeInstanceOf(Date);
    expect(toSafeDate(new Date('invalid'))).toBeNull();
  });

  it('formatDuration', () => {
    expect(formatDuration(45)).toBe('45min');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(125)).toBe('2h05');
  });

  it('formatPhone', () => {
    expect(formatPhone('0612345678')).toBe('06 12 34 56 78');
    expect(formatPhone('33612345678')).toBe('+33 6 12 34 56 78');
    expect(formatPhone('123')).toBe('123');
  });

  it('formatFileSizeFR', () => {
    expect(formatFileSizeFR(500)).toBe('500 o');
    expect(formatFileSizeFR(2048)).toBe('2.0 Ko');
    expect(formatFileSizeFR(2 * 1024 * 1024)).toBe('2.0 Mo');
    expect(formatFileSizeFR(3 * 1024 * 1024 * 1024)).toBe('3.0 Go');
  });

  it('truncate', () => {
    expect(truncate('hello', 10)).toBe('hello');
    expect(truncate('hello world', 8)).toBe('hello...');
  });

  it('getInitials', () => {
    expect(getInitials('John Doe')).toBe('JD');
    expect(getInitials('alice bob carol')).toBe('AB');
  });

  it('formatCurrencyCustom', () => {
    expect(formatCurrencyCustom(100, 'USD')).toMatch(/100/);
  });
});
