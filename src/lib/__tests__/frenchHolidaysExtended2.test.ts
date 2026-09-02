import { describe, it, expect } from 'vitest';
import { getFrenchHolidays, isFrenchHoliday } from '../frenchHolidays';

describe('frenchHolidays (extended2)', () => {
  describe('getFrenchHolidays', () => {
    it('returns 11 holidays', () => expect(getFrenchHolidays(2026).length).toBe(11));

    it('includes Jour de l\'An', () => {
      const holidays = getFrenchHolidays(2026);
      expect(holidays.some(d => d.getMonth() === 0 && d.getDate() === 1)).toBe(true);
    });

    it('includes Fête du Travail (1er mai)', () => {
      const holidays = getFrenchHolidays(2026);
      expect(holidays.some(d => d.getMonth() === 4 && d.getDate() === 1)).toBe(true);
    });

    it('includes 14 juillet', () => {
      const holidays = getFrenchHolidays(2026);
      expect(holidays.some(d => d.getMonth() === 6 && d.getDate() === 14)).toBe(true);
    });

    it('includes Noël', () => {
      const holidays = getFrenchHolidays(2026);
      expect(holidays.some(d => d.getMonth() === 11 && d.getDate() === 25)).toBe(true);
    });

    it('includes Toussaint (1er novembre)', () => {
      const holidays = getFrenchHolidays(2026);
      expect(holidays.some(d => d.getMonth() === 10 && d.getDate() === 1)).toBe(true);
    });

    it('includes Armistice (11 novembre)', () => {
      const holidays = getFrenchHolidays(2026);
      expect(holidays.some(d => d.getMonth() === 10 && d.getDate() === 11)).toBe(true);
    });

    it('Easter-based holidays vary by year', () => {
      const h2025 = getFrenchHolidays(2025);
      const h2026 = getFrenchHolidays(2026);
      // Ascension differs between years
      const ascension2025 = h2025[4]; // index 4 = Ascension
      const ascension2026 = h2026[4];
      expect(ascension2025.getTime()).not.toBe(ascension2026.getTime());
    });
  });

  describe('isFrenchHoliday', () => {
    it('1er janvier → true', () => expect(isFrenchHoliday(new Date(2026, 0, 1))).toBe(true));
    it('Noël → true', () => expect(isFrenchHoliday(new Date(2026, 11, 25))).toBe(true));
    it('random date → false', () => expect(isFrenchHoliday(new Date(2026, 2, 9))).toBe(false));
    it('14 juillet → true', () => expect(isFrenchHoliday(new Date(2026, 6, 14))).toBe(true));
  });
});
