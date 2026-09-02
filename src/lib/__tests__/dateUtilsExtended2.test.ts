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

describe('dateUtils extended2', () => {
  describe('formatDate', () => {
    it('formats string date', () => {
      const result = formatDate('2026-01-15');
      expect(result).toContain('janv');
    });
    it('formats Date object', () => {
      const result = formatDate(new Date(2026, 0, 15));
      expect(result).toContain('janv');
    });
    it('custom format', () => {
      const result = formatDate('2026-03-09', 'dd/MM/yyyy');
      expect(result).toBe('09/03/2026');
    });
  });

  describe('getWeekDays', () => {
    it('returns 7 days', () => {
      expect(getWeekDays(new Date(2026, 2, 9))).toHaveLength(7);
    });
    it('starts on Monday', () => {
      const days = getWeekDays(new Date(2026, 2, 11)); // Wednesday
      expect(days[0].getDay()).toBe(1); // Monday
    });
    it('ends on Sunday', () => {
      const days = getWeekDays(new Date(2026, 2, 11));
      expect(days[6].getDay()).toBe(0); // Sunday
    });
  });

  describe('getMonthDays', () => {
    it('Feb 2026 has 28 days', () => {
      expect(getMonthDays(new Date(2026, 1, 1))).toHaveLength(28);
    });
    it('March 2026 has 31 days', () => {
      expect(getMonthDays(new Date(2026, 2, 1))).toHaveLength(31);
    });
  });

  describe('isDateInRange', () => {
    const d = new Date(2026, 2, 9);
    it('no range → true', () => expect(isDateInRange(d, null, null)).toBe(true));
    it('only end, before → true', () => expect(isDateInRange(d, null, new Date(2026, 5, 1))).toBe(true));
    it('only end, after → false', () => expect(isDateInRange(d, null, new Date(2026, 0, 1))).toBe(false));
    it('only start, after → true', () => expect(isDateInRange(d, new Date(2026, 0, 1), null)).toBe(true));
    it('only start, before → false', () => expect(isDateInRange(d, new Date(2026, 5, 1), null)).toBe(false));
    it('within range → true', () => expect(isDateInRange(d, new Date(2026, 0, 1), new Date(2026, 5, 1))).toBe(true));
    it('outside range → false', () => expect(isDateInRange(d, new Date(2026, 5, 1), new Date(2026, 6, 1))).toBe(false));
    it('same day as start → true', () => expect(isDateInRange(d, d, new Date(2026, 5, 1))).toBe(true));
    it('same day as end → true', () => expect(isDateInRange(d, new Date(2026, 0, 1), d)).toBe(true));
  });

  describe('getDaysUntil', () => {
    it('future date → positive', () => {
      const future = new Date(); future.setDate(future.getDate() + 10);
      expect(getDaysUntil(future)).toBeGreaterThanOrEqual(9);
    });
    it('past date → negative', () => {
      const past = new Date(); past.setDate(past.getDate() - 10);
      expect(getDaysUntil(past)).toBeLessThan(0);
    });
    it('accepts string', () => {
      const future = new Date(); future.setDate(future.getDate() + 5);
      expect(getDaysUntil(future.toISOString())).toBeGreaterThanOrEqual(4);
    });
  });

  describe('isOverdue', () => {
    it('past → true', () => expect(isOverdue('2020-01-01')).toBe(true));
    it('future → false', () => expect(isOverdue('2099-01-01')).toBe(false));
    it('today → false', () => expect(isOverdue(new Date())).toBe(false));
  });

  describe('normalizeMonthToDate', () => {
    it('YYYY-MM-DD → YYYY-MM-01', () => expect(normalizeMonthToDate('2026-03-15')).toBe('2026-03-01'));
    it('Date object', () => expect(normalizeMonthToDate(new Date(2026, 11, 25))).toBe('2026-12-01'));
  });

  describe('groupTasksByDate', () => {
    it('groups by date', () => {
      const tasks = [
        { echeance: '2026-03-09' },
        { echeance: '2026-03-09' },
        { echeance: '2026-03-10' },
      ];
      const groups = groupTasksByDate(tasks);
      expect(groups.get('2026-03-09')).toHaveLength(2);
      expect(groups.get('2026-03-10')).toHaveLength(1);
    });
    it('ignores tasks without echeance', () => {
      const groups = groupTasksByDate([{ echeance: undefined }, { echeance: '2026-01-01' }]);
      expect(groups.size).toBe(1);
    });
    it('empty → empty', () => expect(groupTasksByDate([]).size).toBe(0));
  });

  describe('getDatePresets', () => {
    it('returns 5 presets', () => {
      const presets = getDatePresets();
      expect(presets.today).toBeDefined();
      expect(presets.thisWeek).toBeDefined();
      expect(presets.next7Days).toBeDefined();
      expect(presets.next30Days).toBeDefined();
      expect(presets.thisMonth).toBeDefined();
    });
    it('today start === end', () => {
      const p = getDatePresets();
      expect(p.today.start.toDateString()).toBe(p.today.end.toDateString());
    });
  });
});
