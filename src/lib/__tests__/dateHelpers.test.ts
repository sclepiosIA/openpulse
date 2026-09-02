import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isToday,
  isPast,
  isFuture,
  addDays,
  differenceInDaysAbs,
  getStartOfWeek,
  getStartOfMonth,
  getEndOfMonth,
  formatRelativeTime,
  isWeekend,
  getBusinessDays,
  parseISODate,
  getQuarter,
} from '../dateHelpers';

describe('dateHelpers', () => {
  describe('isToday', () => {
    it('returns true for today', () => {
      expect(isToday(new Date())).toBe(true);
    });
    it('returns false for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isToday(yesterday)).toBe(false);
    });
  });

  describe('isPast / isFuture', () => {
    it('past date is past', () => {
      expect(isPast(new Date(2020, 0, 1))).toBe(true);
    });
    it('future date is future', () => {
      expect(isFuture(new Date(2030, 0, 1))).toBe(true);
    });
  });

  describe('addDays', () => {
    it('adds days correctly', () => {
      const date = new Date(2025, 0, 1);
      const result = addDays(date, 5);
      expect(result.getDate()).toBe(6);
    });
    it('handles negative days', () => {
      const date = new Date(2025, 0, 10);
      expect(addDays(date, -3).getDate()).toBe(7);
    });
  });

  describe('differenceInDaysAbs', () => {
    it('returns absolute difference', () => {
      const d1 = new Date(2025, 0, 1);
      const d2 = new Date(2025, 0, 4);
      expect(differenceInDaysAbs(d1, d2)).toBe(3);
      expect(differenceInDaysAbs(d2, d1)).toBe(3);
    });
  });

  describe('getStartOfWeek', () => {
    it('returns Monday for a Wednesday', () => {
      // 2025-03-05 is a Wednesday
      const wed = new Date(2025, 2, 5);
      const start = getStartOfWeek(wed);
      expect(start.getDay()).toBe(1); // Monday
    });
  });

  describe('getStartOfMonth / getEndOfMonth', () => {
    it('returns first day of month', () => {
      const date = new Date(2025, 2, 15);
      expect(getStartOfMonth(date).getDate()).toBe(1);
    });
    it('returns last day of month', () => {
      const date = new Date(2025, 1, 15); // Feb
      expect(getEndOfMonth(date).getDate()).toBe(28);
    });
  });

  describe('formatRelativeTime', () => {
    it('returns "à l\'instant" for now', () => {
      expect(formatRelativeTime(new Date())).toBe("à l'instant");
    });
    it('returns minutes for recent', () => {
      const d = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatRelativeTime(d)).toBe('il y a 5 min');
    });
    it('returns hours', () => {
      const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(formatRelativeTime(d)).toBe('il y a 3h');
    });
    it('returns "hier" for 1 day ago', () => {
      const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(d)).toBe('hier');
    });
  });

  describe('isWeekend', () => {
    it('returns true for Saturday', () => {
      // 2025-03-08 is Saturday
      expect(isWeekend(new Date(2025, 2, 8))).toBe(true);
    });
    it('returns false for Monday', () => {
      expect(isWeekend(new Date(2025, 2, 3))).toBe(false);
    });
  });

  describe('getBusinessDays', () => {
    it('counts weekdays only', () => {
      // Mon Mar 3 to Fri Mar 7 = 5 business days
      const start = new Date(2025, 2, 3);
      const end = new Date(2025, 2, 7);
      expect(getBusinessDays(start, end)).toBe(5);
    });
  });

  describe('parseISODate', () => {
    it('parses valid ISO date', () => {
      const result = parseISODate('2025-01-15T10:00:00Z');
      expect(result).toBeInstanceOf(Date);
    });
    it('returns null for invalid', () => {
      expect(parseISODate('not-a-date')).toBeNull();
    });
  });

  describe('getQuarter', () => {
    it('returns Q1 for January', () => {
      expect(getQuarter(new Date(2025, 0, 15))).toBe(1);
    });
    it('returns Q4 for December', () => {
      expect(getQuarter(new Date(2025, 11, 15))).toBe(4);
    });
  });
});
