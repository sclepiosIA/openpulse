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

describe('rhUtils', () => {
  it('calculateNetFromGross', () => {
    expect(calculateNetFromGross(3000)).toBe(2340);
    expect(calculateNetFromGross(3000, 0.25)).toBe(2250);
  });

  it('calculateEmployerCost', () => {
    expect(calculateEmployerCost(2000)).toBe(2900);
  });

  it('calculateMonthlyPayroll aggregates', () => {
    const out = calculateMonthlyPayroll([
      { salaire_brut: 3000, salaire_net: 2340, cotisations_patronales: 1350 },
      { salaire_brut: 2000, salaire_net: 1560, cotisations_patronales: 900 },
    ]);
    expect(out.totalBrut).toBe(5000);
    expect(out.totalNet).toBe(3900);
    expect(out.totalEmployerCost).toBe(7250);
  });

  it('calculateIncreasePercentage', () => {
    expect(calculateIncreasePercentage(2000, 2200)).toBe(10);
    expect(calculateIncreasePercentage(0, 1000)).toBe(0);
  });

  it('projectAnnualSalary', () => {
    expect(projectAnnualSalary(1000)).toBe(12000);
    expect(projectAnnualSalary(1000, 6)).toBe(6000);
  });

  it('calculateRemainingLeave', () => {
    expect(calculateRemainingLeave(25, 10, 2)).toBe(13);
  });

  it('calculateCPAcquisition caps at 30', () => {
    expect(calculateCPAcquisition(6)).toBe(15);
    expect(calculateCPAcquisition(20)).toBe(30);
  });

  it('countWorkingDays excludes weekends', () => {
    // Mon 2024-01-01 → Sun 2024-01-07 = 5 working days
    expect(countWorkingDays(new Date('2024-01-01'), new Date('2024-01-07'))).toBe(5);
  });

  it('hasOverlap', () => {
    expect(hasOverlap(
      { startDate: new Date('2024-01-01'), endDate: new Date('2024-01-10') },
      { startDate: new Date('2024-01-05'), endDate: new Date('2024-01-15') },
    )).toBe(true);
    expect(hasOverlap(
      { startDate: new Date('2024-01-01'), endDate: new Date('2024-01-05') },
      { startDate: new Date('2024-01-10'), endDate: new Date('2024-01-15') },
    )).toBe(false);
  });

  it('categorizeDocument', () => {
    expect(categorizeDocument('Mon Contrat.pdf')).toBe('contract');
    expect(categorizeDocument('bulletin-2024.pdf')).toBe('payslip');
    expect(categorizeDocument('paie.pdf')).toBe('payslip');
    expect(categorizeDocument('Attestation.pdf')).toBe('certificate');
    expect(categorizeDocument('cv-john.pdf')).toBe('cv');
    expect(categorizeDocument('formation-rgpd.pdf')).toBe('training');
    expect(categorizeDocument('random.pdf')).toBe('other');
  });

  it('shouldArchive based on retention', () => {
    const oldDate = new Date(); oldDate.setFullYear(oldDate.getFullYear() - 10);
    const newDate = new Date();
    expect(shouldArchive('contract', oldDate, { contract: 5 })).toBe(true);
    expect(shouldArchive('contract', newDate, { contract: 5 })).toBe(false);
    // Unknown type → default 5y
    expect(shouldArchive('xxx', oldDate, {})).toBe(true);
  });

  it('calculateTurnoverRate', () => {
    expect(calculateTurnoverRate(5, 50)).toBe(10);
    expect(calculateTurnoverRate(5, 0)).toBe(0);
  });

  it('calculateAverageSeniority', () => {
    const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const twoYearsAgo = new Date(); twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 3);
    const out = calculateAverageSeniority([{ hireDate: oneYearAgo }, { hireDate: twoYearsAgo }]);
    expect(out).toBeGreaterThan(1.5);
    expect(out).toBeLessThan(2.5);
    expect(calculateAverageSeniority([])).toBe(0);
  });

  it('countByDepartment ignores inactive', () => {
    const out = countByDepartment([
      { department: 'IT', isActive: true },
      { department: 'IT', isActive: true },
      { department: 'RH', isActive: true },
      { department: 'IT', isActive: false },
    ]);
    expect(out).toEqual({ IT: 2, RH: 1 });
  });
});
