import { describe, it, expect } from 'vitest';
import {
  formatDate,
  getWeekDays,
  getMonthDays,
  isDateInRange,
  getDaysUntil,
  isOverdue,
  normalizeMonthToDate,
  groupTasksByDate,
  getDatePresets,
} from '../dateUtils';

describe('dateUtils', () => {
  describe('formatDate', () => {
    it('formats Date object', () => {
      const result = formatDate(new Date(2026, 2, 9));
      expect(result).toContain('9');
    });
    it('formats string date', () => {
      const result = formatDate('2026-03-09');
      expect(result).toContain('9');
    });
  });

  describe('getWeekDays', () => {
    it('returns 7 days', () => expect(getWeekDays(new Date(2026, 2, 9)).length).toBe(7));
    it('starts on Monday', () => expect(getWeekDays(new Date(2026, 2, 9))[0].getDay()).toBe(1));
  });

  describe('getMonthDays', () => {
    it('March 2026 has 31 days', () => expect(getMonthDays(new Date(2026, 2, 1)).length).toBe(31));
    it('February 2026 has 28 days', () => expect(getMonthDays(new Date(2026, 1, 1)).length).toBe(28));
  });

  describe('isDateInRange', () => {
    const date = new Date(2026, 2, 15);
    it('in range → true', () => expect(isDateInRange(date, new Date(2026, 2, 1), new Date(2026, 2, 31))).toBe(true));
    it('out of range → false', () => expect(isDateInRange(date, new Date(2026, 3, 1), new Date(2026, 3, 30))).toBe(false));
    it('no bounds → true', () => expect(isDateInRange(date, null, null)).toBe(true));
    it('only start → after', () => expect(isDateInRange(date, new Date(2026, 2, 1), null)).toBe(true));
    it('only end → before', () => expect(isDateInRange(date, null, new Date(2026, 2, 20))).toBe(true));
  });

  describe('getDaysUntil', () => {
    it('future → positive', () => {
      const future = new Date(); future.setDate(future.getDate() + 5);
      expect(getDaysUntil(future)).toBeGreaterThanOrEqual(4);
    });
    it('past → negative', () => {
      const past = new Date(); past.setDate(past.getDate() - 3);
      expect(getDaysUntil(past)).toBeLessThan(0);
    });
    it('accepts string', () => {
      const future = new Date(); future.setDate(future.getDate() + 5);
      expect(getDaysUntil(future.toISOString())).toBeGreaterThanOrEqual(4);
    });
  });

  describe('isOverdue', () => {
    it('past → true', () => {
      const past = new Date(); past.setDate(past.getDate() - 2);
      expect(isOverdue(past)).toBe(true);
    });
    it('future → false', () => {
      const future = new Date(); future.setDate(future.getDate() + 2);
      expect(isOverdue(future)).toBe(false);
    });
  });

  describe('normalizeMonthToDate', () => {
    it('YYYY-MM → YYYY-MM-01', () => expect(normalizeMonthToDate('2026-03')).toBe('2026-03-01'));
    it('YYYY-MM-DD → YYYY-MM-01', () => expect(normalizeMonthToDate('2026-03-15')).toBe('2026-03-01'));
    it('Date → YYYY-MM-01', () => expect(normalizeMonthToDate(new Date(2026, 2, 15))).toBe('2026-03-01'));
  });

  describe('groupTasksByDate', () => {
    it('groups by echeance', () => {
      const tasks = [
        { echeance: '2026-03-09' },
        { echeance: '2026-03-09' },
        { echeance: '2026-03-10' },
      ];
      const grouped = groupTasksByDate(tasks);
      expect(grouped.get('2026-03-09')?.length).toBe(2);
      expect(grouped.get('2026-03-10')?.length).toBe(1);
    });
    it('skips tasks without echeance', () => {
      const tasks = [{ echeance: undefined }, { echeance: '2026-03-09' }];
      const grouped = groupTasksByDate(tasks);
      expect(grouped.size).toBe(1);
    });
  });

  describe('getDatePresets', () => {
    it('returns all presets', () => {
      const presets = getDatePresets();
      expect(presets.today).toBeDefined();
      expect(presets.thisWeek).toBeDefined();
      expect(presets.next7Days).toBeDefined();
      expect(presets.next30Days).toBeDefined();
      expect(presets.thisMonth).toBeDefined();
    });
  });
});
