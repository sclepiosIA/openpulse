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

describe('rhUtils (extended2)', () => {
  describe('calculateNetFromGross', () => {
    it('default rate', () => expect(calculateNetFromGross(3000)).toBe(2340));
    it('custom rate', () => expect(calculateNetFromGross(3000, 0.25)).toBe(2250));
  });

  describe('calculateEmployerCost', () => {
    it('default rate', () => expect(calculateEmployerCost(3000)).toBe(4350));
    it('custom rate', () => expect(calculateEmployerCost(3000, 0.50)).toBe(4500));
  });

  describe('calculateMonthlyPayroll', () => {
    it('sums correctly', () => {
      const salaries = [
        { salaire_brut: 3000, salaire_net: 2340, cotisations_patronales: 1350 },
        { salaire_brut: 4000, salaire_net: 3120, cotisations_patronales: 1800 },
      ];
      const result = calculateMonthlyPayroll(salaries);
      expect(result.totalNet).toBe(5460);
      expect(result.totalBrut).toBe(7000);
      expect(result.totalEmployerCost).toBe(10150);
    });
  });

  describe('calculateIncreasePercentage', () => {
    it('10% increase', () => expect(calculateIncreasePercentage(3000, 3300)).toBe(10));
    it('0 old salary → 0', () => expect(calculateIncreasePercentage(0, 3000)).toBe(0));
  });

  describe('projectAnnualSalary', () => {
    it('12 months', () => expect(projectAnnualSalary(3000)).toBe(36000));
    it('custom months', () => expect(projectAnnualSalary(3000, 13)).toBe(39000));
  });

  describe('calculateRemainingLeave', () => {
    it('calculates correctly', () => expect(calculateRemainingLeave(25, 10, 3)).toBe(12));
  });

  describe('calculateCPAcquisition', () => {
    it('6 months → 15 days', () => expect(calculateCPAcquisition(6)).toBe(15));
    it('caps at 30', () => expect(calculateCPAcquisition(15)).toBe(30));
    it('custom rate', () => expect(calculateCPAcquisition(4, 2.08)).toBeCloseTo(8.32));
  });

  describe('countWorkingDays', () => {
    it('Mon-Fri → 5', () => {
      const start = new Date(2026, 2, 9); // Monday
      const end = new Date(2026, 2, 13);   // Friday
      expect(countWorkingDays(start, end)).toBe(5);
    });
    it('includes weekends → still 5', () => {
      const start = new Date(2026, 2, 9);  // Monday
      const end = new Date(2026, 2, 15);    // Sunday
      expect(countWorkingDays(start, end)).toBe(5);
    });
  });

  describe('hasOverlap', () => {
    it('overlapping', () => {
      const a = { startDate: new Date(2026, 2, 1), endDate: new Date(2026, 2, 10) };
      const b = { startDate: new Date(2026, 2, 5), endDate: new Date(2026, 2, 15) };
      expect(hasOverlap(a, b)).toBe(true);
    });
    it('non-overlapping', () => {
      const a = { startDate: new Date(2026, 2, 1), endDate: new Date(2026, 2, 5) };
      const b = { startDate: new Date(2026, 2, 6), endDate: new Date(2026, 2, 10) };
      expect(hasOverlap(a, b)).toBe(false);
    });
    it('touching → overlap', () => {
      const a = { startDate: new Date(2026, 2, 1), endDate: new Date(2026, 2, 5) };
      const b = { startDate: new Date(2026, 2, 5), endDate: new Date(2026, 2, 10) };
      expect(hasOverlap(a, b)).toBe(true);
    });
  });

  describe('categorizeDocument', () => {
    it('contrat → contract', () => expect(categorizeDocument('contrat_cdi.pdf')).toBe('contract'));
    it('bulletin → payslip', () => expect(categorizeDocument('bulletin_mars.pdf')).toBe('payslip'));
    it('paie → payslip', () => expect(categorizeDocument('fiche_paie.pdf')).toBe('payslip'));
    it('attestation → certificate', () => expect(categorizeDocument('attestation_travail.pdf')).toBe('certificate'));
    it('cv → cv', () => expect(categorizeDocument('cv_jean.pdf')).toBe('cv'));
    it('formation → training', () => expect(categorizeDocument('formation_securite.pdf')).toBe('training'));
    it('other → other', () => expect(categorizeDocument('notes.pdf')).toBe('other'));
  });

  describe('shouldArchive', () => {
    it('old document → true', () => {
      const old = new Date();
      old.setFullYear(old.getFullYear() - 10);
      expect(shouldArchive('contract', old, { contract: 5 })).toBe(true);
    });
    it('recent document → false', () => {
      expect(shouldArchive('contract', new Date(), { contract: 5 })).toBe(false);
    });
    it('unknown type → default 5 years', () => {
      const old = new Date();
      old.setFullYear(old.getFullYear() - 6);
      expect(shouldArchive('unknown', old, {})).toBe(true);
    });
  });

  describe('calculateTurnoverRate', () => {
    it('calculates correctly', () => expect(calculateTurnoverRate(5, 50)).toBe(10));
    it('0 headcount → 0', () => expect(calculateTurnoverRate(5, 0)).toBe(0));
  });

  describe('calculateAverageSeniority', () => {
    it('empty → 0', () => expect(calculateAverageSeniority([])).toBe(0));
    it('calculates average', () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const result = calculateAverageSeniority([{ hireDate: twoYearsAgo }]);
      expect(result).toBeCloseTo(2, 0);
    });
  });

  describe('countByDepartment', () => {
    it('counts active employees', () => {
      const emps = [
        { department: 'IT', isActive: true },
        { department: 'IT', isActive: true },
        { department: 'HR', isActive: true },
        { department: 'IT', isActive: false },
      ];
      expect(countByDepartment(emps)).toEqual({ IT: 2, HR: 1 });
    });
  });
});
