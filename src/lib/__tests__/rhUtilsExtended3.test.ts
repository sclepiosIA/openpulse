import { describe, it, expect } from 'vitest';
import {
  countWorkingDays,
  hasOverlap,
  categorizeDocument,
  shouldArchive,
  calculateTurnoverRate,
  calculateAverageSeniority,
  countByDepartment,
} from '../rhUtils';

describe('rhUtils extended3', () => {
  describe('countWorkingDays', () => {
    it('Mon-Fri = 5 days', () => {
      expect(countWorkingDays(new Date(2026, 2, 2), new Date(2026, 2, 6))).toBe(5);
    });
    it('Mon-Sun = 5 working days', () => {
      expect(countWorkingDays(new Date(2026, 2, 2), new Date(2026, 2, 8))).toBe(5);
    });
    it('same day (weekday) = 1', () => {
      expect(countWorkingDays(new Date(2026, 2, 2), new Date(2026, 2, 2))).toBe(1);
    });
    it('same day (weekend) = 0', () => {
      expect(countWorkingDays(new Date(2026, 2, 7), new Date(2026, 2, 7))).toBe(0);
    });
    it('two weeks = 10 working days', () => {
      expect(countWorkingDays(new Date(2026, 2, 2), new Date(2026, 2, 13))).toBe(10);
    });
  });

  describe('hasOverlap', () => {
    it('overlapping', () => {
      expect(hasOverlap(
        { startDate: new Date(2026, 0, 1), endDate: new Date(2026, 0, 10) },
        { startDate: new Date(2026, 0, 5), endDate: new Date(2026, 0, 15) },
      )).toBe(true);
    });
    it('adjacent (end=start)', () => {
      expect(hasOverlap(
        { startDate: new Date(2026, 0, 1), endDate: new Date(2026, 0, 5) },
        { startDate: new Date(2026, 0, 5), endDate: new Date(2026, 0, 10) },
      )).toBe(true);
    });
    it('no overlap', () => {
      expect(hasOverlap(
        { startDate: new Date(2026, 0, 1), endDate: new Date(2026, 0, 3) },
        { startDate: new Date(2026, 0, 5), endDate: new Date(2026, 0, 10) },
      )).toBe(false);
    });
    it('contained', () => {
      expect(hasOverlap(
        { startDate: new Date(2026, 0, 1), endDate: new Date(2026, 0, 20) },
        { startDate: new Date(2026, 0, 5), endDate: new Date(2026, 0, 10) },
      )).toBe(true);
    });
  });

  describe('categorizeDocument', () => {
    it('contrat → contract', () => expect(categorizeDocument('contrat-cdi.pdf')).toBe('contract'));
    it('bulletin → payslip', () => expect(categorizeDocument('bulletin_paie_mars.pdf')).toBe('payslip'));
    it('paie → payslip', () => expect(categorizeDocument('fiche-paie.pdf')).toBe('payslip'));
    it('attestation → certificate', () => expect(categorizeDocument('attestation_travail.pdf')).toBe('certificate'));
    it('cv → cv', () => expect(categorizeDocument('CV_Jean.pdf')).toBe('cv'));
    it('curriculum → cv', () => expect(categorizeDocument('curriculum_vitae.pdf')).toBe('cv'));
    it('formation → training', () => expect(categorizeDocument('formation_sst.pdf')).toBe('training'));
    it('unknown → other', () => expect(categorizeDocument('photo.jpg')).toBe('other'));
    it('case insensitive', () => expect(categorizeDocument('CONTRAT.PDF')).toBe('contract'));
  });

  describe('shouldArchive', () => {
    it('old document → true', () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 10);
      expect(shouldArchive('contract', oldDate, { contract: 5 })).toBe(true);
    });
    it('recent document → false', () => {
      expect(shouldArchive('contract', new Date(), { contract: 5 })).toBe(false);
    });
    it('uses default 5 years for unknown type', () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 6);
      expect(shouldArchive('unknown', oldDate, {})).toBe(true);
    });
  });

  describe('calculateTurnoverRate', () => {
    it('basic calc', () => expect(calculateTurnoverRate(2, 50)).toBe(4));
    it('0 headcount → 0', () => expect(calculateTurnoverRate(5, 0)).toBe(0));
    it('0 departures → 0', () => expect(calculateTurnoverRate(0, 50)).toBe(0));
  });

  describe('calculateAverageSeniority', () => {
    it('empty → 0', () => expect(calculateAverageSeniority([])).toBe(0));
    it('calculates years', () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const result = calculateAverageSeniority([{ hireDate: twoYearsAgo }]);
      expect(result).toBeGreaterThanOrEqual(1.9);
      expect(result).toBeLessThanOrEqual(2.1);
    });
  });

  describe('countByDepartment', () => {
    it('groups active employees', () => {
      const employees = [
        { department: 'IT', isActive: true },
        { department: 'IT', isActive: true },
        { department: 'HR', isActive: true },
        { department: 'IT', isActive: false },
      ];
      const result = countByDepartment(employees);
      expect(result['IT']).toBe(2);
      expect(result['HR']).toBe(1);
    });
    it('ignores inactive', () => {
      const result = countByDepartment([{ department: 'IT', isActive: false }]);
      expect(result['IT']).toBeUndefined();
    });
    it('empty → empty', () => expect(countByDepartment([])).toEqual({}));
  });
});
