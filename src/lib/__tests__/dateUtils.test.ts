import { describe, it, expect } from 'vitest';
import {
  isToday,
  isPast,
  isFuture,
  addDays,
  differenceInDaysAbs,
  getStartOfMonth,
  getEndOfMonth,
  isWeekend,
  getBusinessDays,
  parseISODate,
  getQuarter,
  formatRelativeTime,
} from '../dateUtils';

describe('dateUtils — vanilla helpers', () => {
  it('isToday/isPast/isFuture', () => {
    expect(isToday(new Date())).toBe(true);
    expect(isPast(new Date('2000-01-01'))).toBe(true);
    expect(isFuture(new Date('2999-01-01'))).toBe(true);
    expect(isPast(new Date('2999-01-01'))).toBe(false);
  });

  it('addDays', () => {
    const d = new Date('2026-01-01T00:00:00');
    expect(addDays(d, 5).getDate()).toBe(6);
    expect(addDays(d, -1).getMonth()).toBe(11); // décembre
  });

  it('differenceInDaysAbs', () => {
    const a = new Date('2026-01-01');
    const b = new Date('2026-01-11');
    expect(differenceInDaysAbs(a, b)).toBe(10);
    expect(differenceInDaysAbs(b, a)).toBe(10);
  });

  it('getStartOfMonth / getEndOfMonth', () => {
    const d = new Date('2026-06-15T12:00:00');
    const s = getStartOfMonth(d);
    const e = getEndOfMonth(d);
    expect(s.getDate()).toBe(1);
    expect(s.getHours()).toBe(0);
    expect(e.getMonth()).toBe(5); // juin (0-indexé)
    expect(e.getHours()).toBe(23);
  });

  it('isWeekend', () => {
    expect(isWeekend(new Date('2026-06-06'))).toBe(true); // samedi
    expect(isWeekend(new Date('2026-06-07'))).toBe(true); // dimanche
    expect(isWeekend(new Date('2026-06-08'))).toBe(false); // lundi
  });

  it('getBusinessDays', () => {
    // Lundi 8 → Vendredi 12 juin 2026 = 5 jours ouvrés
    const start = new Date('2026-06-08');
    const end = new Date('2026-06-12');
    expect(getBusinessDays(start, end)).toBe(5);
    // Lundi 8 → Dimanche 14 = 5 jours ouvrés (samedi/dimanche exclus)
    expect(getBusinessDays(start, new Date('2026-06-14'))).toBe(5);
  });

  it('parseISODate', () => {
    expect(parseISODate('2026-06-07')).toBeInstanceOf(Date);
    expect(parseISODate('invalid')).toBeNull();
  });

  it('getQuarter', () => {
    expect(getQuarter(new Date('2026-01-15'))).toBe(1);
    expect(getQuarter(new Date('2026-04-01'))).toBe(2);
    expect(getQuarter(new Date('2026-07-01'))).toBe(3);
    expect(getQuarter(new Date('2026-12-31'))).toBe(4);
  });

  it('formatRelativeTime', () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toMatch(/instant/);
    expect(formatRelativeTime(new Date(now.getTime() - 5 * 60 * 1000))).toMatch(/min/);
    expect(formatRelativeTime(new Date(now.getTime() - 3 * 60 * 60 * 1000))).toMatch(/h/);
    expect(formatRelativeTime(new Date(now.getTime() - 24 * 60 * 60 * 1000))).toBe('hier');
  });
});
