import { describe, it, expect } from 'vitest';
import {
  addDays,
  differenceInDaysAbs,
  getStartOfWeek,
  getEndOfWeek,
  getStartOfMonth,
  getEndOfMonth,
  isWeekend,
  getBusinessDays,
  parseISODate,
  getQuarter,
  formatRelativeTime,
} from '../dateHelpers';

describe('dateHelpers - extended', () => {
  describe('addDays', () => {
    it('adds positive days', () => {
      const d = addDays(new Date(2026, 2, 9), 5);
      expect(d.getDate()).toBe(14);
    });
    it('subtracts with negative days', () => {
      const d = addDays(new Date(2026, 2, 9), -3);
      expect(d.getDate()).toBe(6);
    });
  });

  describe('differenceInDaysAbs', () => {
    it('returns absolute difference', () => {
      expect(differenceInDaysAbs(new Date(2026, 2, 1), new Date(2026, 2, 10))).toBe(9);
    });
    it('order independent', () => {
      expect(differenceInDaysAbs(new Date(2026, 2, 10), new Date(2026, 2, 1))).toBe(9);
    });
  });

  describe('getStartOfWeek', () => {
    it('returns Monday', () => {
      // March 11, 2026 is Wednesday → start = March 9 (Monday)
      const d = getStartOfWeek(new Date(2026, 2, 11));
      expect(d.getDay()).toBe(1); // Monday
      expect(d.getDate()).toBe(9);
    });
    it('handles Sunday', () => {
      // March 15, 2026 is Sunday → start = March 9 (Monday)
      const d = getStartOfWeek(new Date(2026, 2, 15));
      expect(d.getDay()).toBe(1);
    });
  });

  describe('getEndOfWeek', () => {
    it('returns Sunday', () => {
      const d = getEndOfWeek(new Date(2026, 2, 9)); // Monday
      expect(d.getDay()).toBe(0); // Sunday
    });
  });

  describe('getStartOfMonth', () => {
    it('returns 1st of month', () => {
      const d = getStartOfMonth(new Date(2026, 2, 15));
      expect(d.getDate()).toBe(1);
      expect(d.getMonth()).toBe(2);
    });
  });

  describe('getEndOfMonth', () => {
    it('returns last day of month', () => {
      const d = getEndOfMonth(new Date(2026, 1, 15)); // Feb 2026
      expect(d.getDate()).toBe(28);
    });
    it('handles March (31 days)', () => {
      const d = getEndOfMonth(new Date(2026, 2, 1));
      expect(d.getDate()).toBe(31);
    });
  });

  describe('isWeekend', () => {
    it('Saturday is weekend', () => expect(isWeekend(new Date(2026, 2, 14))).toBe(true));
    it('Sunday is weekend', () => expect(isWeekend(new Date(2026, 2, 15))).toBe(true));
    it('Monday is not weekend', () => expect(isWeekend(new Date(2026, 2, 9))).toBe(false));
  });

  describe('getBusinessDays', () => {
    it('counts 5 for a full week', () => {
      expect(getBusinessDays(new Date(2026, 2, 9), new Date(2026, 2, 13))).toBe(5);
    });
    it('counts 0 for Saturday to Sunday', () => {
      expect(getBusinessDays(new Date(2026, 2, 14), new Date(2026, 2, 15))).toBe(0);
    });
  });

  describe('parseISODate', () => {
    it('parses valid ISO string', () => {
      const d = parseISODate('2026-03-09T10:00:00Z');
      expect(d).not.toBeNull();
      expect(d!.getFullYear()).toBe(2026);
    });
    it('returns null for invalid', () => {
      expect(parseISODate('not-a-date')).toBeNull();
    });
  });

  describe('getQuarter', () => {
    it('Q1 for Jan', () => expect(getQuarter(new Date(2026, 0, 15))).toBe(1));
    it('Q2 for Apr', () => expect(getQuarter(new Date(2026, 3, 15))).toBe(2));
    it('Q3 for Jul', () => expect(getQuarter(new Date(2026, 6, 15))).toBe(3));
    it('Q4 for Dec', () => expect(getQuarter(new Date(2026, 11, 15))).toBe(4));
  });

  describe('formatRelativeTime', () => {
    it("returns 'à l'instant' for now", () => {
      expect(formatRelativeTime(new Date())).toBe("à l'instant");
    });
    it('returns minutes ago', () => {
      const d = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatRelativeTime(d)).toBe('il y a 5 min');
    });
    it('returns hours ago', () => {
      const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(formatRelativeTime(d)).toBe('il y a 3h');
    });
    it('returns hier', () => {
      const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(d)).toBe('hier');
    });
  });
});
