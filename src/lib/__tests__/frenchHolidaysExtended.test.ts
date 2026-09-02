import { describe, it, expect } from 'vitest';
import { getFrenchHolidays, isFrenchHoliday } from '../frenchHolidays';

describe('frenchHolidays - extended', () => {
  describe('getFrenchHolidays', () => {
    it('returns 11 holidays for 2026', () => {
      expect(getFrenchHolidays(2026).length).toBe(11);
    });
    it('includes Jan 1', () => {
      const holidays = getFrenchHolidays(2026);
      expect(holidays.some(h => h.getMonth() === 0 && h.getDate() === 1)).toBe(true);
    });
    it('includes Jul 14', () => {
      const holidays = getFrenchHolidays(2026);
      expect(holidays.some(h => h.getMonth() === 6 && h.getDate() === 14)).toBe(true);
    });
    it('includes Dec 25', () => {
      const holidays = getFrenchHolidays(2026);
      expect(holidays.some(h => h.getMonth() === 11 && h.getDate() === 25)).toBe(true);
    });
    it('includes May 1', () => {
      const holidays = getFrenchHolidays(2026);
      expect(holidays.some(h => h.getMonth() === 4 && h.getDate() === 1)).toBe(true);
    });
    it('is deterministic', () => {
      const a = getFrenchHolidays(2026);
      const b = getFrenchHolidays(2026);
      expect(a.map(d => d.getTime())).toEqual(b.map(d => d.getTime()));
    });
  });

  describe('isFrenchHoliday', () => {
    it('Jan 1 is holiday', () => expect(isFrenchHoliday(new Date(2026, 0, 1))).toBe(true));
    it('Dec 25 is holiday', () => expect(isFrenchHoliday(new Date(2026, 11, 25))).toBe(true));
    it('Jul 14 is holiday', () => expect(isFrenchHoliday(new Date(2026, 6, 14))).toBe(true));
    it('Nov 1 is holiday', () => expect(isFrenchHoliday(new Date(2026, 10, 1))).toBe(true));
    it('Nov 11 is holiday', () => expect(isFrenchHoliday(new Date(2026, 10, 11))).toBe(true));
    it('Mar 9 is not holiday', () => expect(isFrenchHoliday(new Date(2026, 2, 9))).toBe(false));
    it('Feb 14 is not holiday', () => expect(isFrenchHoliday(new Date(2026, 1, 14))).toBe(false));
  });
});
