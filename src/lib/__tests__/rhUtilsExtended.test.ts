import { describe, it, expect } from 'vitest';
import {
  calculateNetFromGross,
  calculateEmployerCost,
  calculateMonthlyPayroll,
  calculateIncreasePercentage,
  projectAnnualSalary,
  calculateRemainingLeave,
  calculateCPAcquisition,
  countWorkingDays,
  hasOverlap,
  categorizeDocument,
  shouldArchive,
  calculateTurnoverRate,
  calculateAverageSeniority,
  countByDepartment,
} from '../rhUtils';

describe('rhUtils - extended', () => {
  describe('calculateNetFromGross', () => {
    it('calculates with default rate', () => {
      expect(calculateNetFromGross(3000)).toBe(2340); // 3000 * 0.78
    });
    it('calculates with custom rate', () => {
      expect(calculateNetFromGross(3000, 0.25)).toBe(2250);
    });
  });

  describe('calculateEmployerCost', () => {
    it('calculates with default rate', () => {
      expect(calculateEmployerCost(3000)).toBe(4350); // 3000 * 1.45
    });
  });

  describe('calculateMonthlyPayroll', () => {
    it('sums salaries', () => {
      const result = calculateMonthlyPayroll([
        { salaire_brut: 3000, salaire_net: 2340, cotisations_patronales: 1350 },
        { salaire_brut: 4000, salaire_net: 3120, cotisations_patronales: 1800 },
      ]);
      expect(result.totalBrut).toBe(7000);
      expect(result.totalNet).toBe(5460);
      expect(result.totalEmployerCost).toBe(10150);
    });
  });

  describe('calculateIncreasePercentage', () => {
    it('calculates correctly', () => expect(calculateIncreasePercentage(3000, 3300)).toBe(10));
    it('returns 0 for zero old salary', () => expect(calculateIncreasePercentage(0, 3000)).toBe(0));
  });

  describe('projectAnnualSalary', () => {
    it('projects 12 months', () => expect(projectAnnualSalary(3000)).toBe(36000));
    it('projects custom months', () => expect(projectAnnualSalary(3000, 13)).toBe(39000));
  });

  describe('calculateRemainingLeave', () => {
    it('calculates remaining', () => expect(calculateRemainingLeave(25, 10, 3)).toBe(12));
  });

  describe('calculateCPAcquisition', () => {
    it('calculates for 12 months', () => expect(calculateCPAcquisition(12)).toBe(30));
    it('caps at 30', () => expect(calculateCPAcquisition(15)).toBe(30));
    it('calculates for 6 months', () => expect(calculateCPAcquisition(6)).toBe(15));
  });

  describe('countWorkingDays', () => {
    it('counts weekdays', () => {
      // Mon Mar 9 to Fri Mar 13 2026 = 5 working days
      expect(countWorkingDays(new Date(2026, 2, 9), new Date(2026, 2, 13))).toBe(5);
    });
    it('excludes weekends', () => {
      // Mon Mar 9 to Sun Mar 15 2026 = 5 working days
      expect(countWorkingDays(new Date(2026, 2, 9), new Date(2026, 2, 15))).toBe(5);
    });
  });

  describe('hasOverlap', () => {
    it('detects overlap', () => {
      expect(hasOverlap(
        { startDate: new Date('2026-03-01'), endDate: new Date('2026-03-10') },
        { startDate: new Date('2026-03-05'), endDate: new Date('2026-03-15') }
      )).toBe(true);
    });
    it('no overlap', () => {
      expect(hasOverlap(
        { startDate: new Date('2026-03-01'), endDate: new Date('2026-03-05') },
        { startDate: new Date('2026-03-10'), endDate: new Date('2026-03-15') }
      )).toBe(false);
    });
  });

  describe('categorizeDocument', () => {
    it('detects contract', () => expect(categorizeDocument('contrat-cdi.pdf')).toBe('contract'));
    it('detects payslip', () => expect(categorizeDocument('bulletin_paie_mars.pdf')).toBe('payslip'));
    it('detects attestation', () => expect(categorizeDocument('attestation_travail.pdf')).toBe('certificate'));
    it('detects CV', () => expect(categorizeDocument('CV_dupont.pdf')).toBe('cv'));
    it('detects training', () => expect(categorizeDocument('formation_securite.pdf')).toBe('training'));
    it('returns other', () => expect(categorizeDocument('photo.jpg')).toBe('other'));
  });

  describe('shouldArchive', () => {
    it('archives old document', () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 10);
      expect(shouldArchive('payslip', oldDate, { payslip: 5 })).toBe(true);
    });
    it('keeps recent document', () => {
      expect(shouldArchive('payslip', new Date(), { payslip: 5 })).toBe(false);
    });
  });

  describe('calculateTurnoverRate', () => {
    it('calculates correctly', () => expect(calculateTurnoverRate(5, 50)).toBe(10));
    it('returns 0 for 0 headcount', () => expect(calculateTurnoverRate(5, 0)).toBe(0));
  });

  describe('calculateAverageSeniority', () => {
    it('returns 0 for empty', () => expect(calculateAverageSeniority([])).toBe(0));
    it('calculates average', () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const result = calculateAverageSeniority([{ hireDate: twoYearsAgo }]);
      expect(result).toBeGreaterThanOrEqual(1.9);
      expect(result).toBeLessThanOrEqual(2.1);
    });
  });

  describe('countByDepartment', () => {
    it('groups active employees', () => {
      const result = countByDepartment([
        { department: 'Dev', isActive: true },
        { department: 'Dev', isActive: true },
        { department: 'RH', isActive: true },
        { department: 'Dev', isActive: false },
      ]);
      expect(result).toEqual({ Dev: 2, RH: 1 });
    });
  });
});
