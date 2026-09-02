/**
 * RH utility functions for salary, absence, and KPI calculations.
 * Extracted from business logic to enable proper unit testing.
 */

export function calculateNetFromGross(brut: number, tauxCotisationsSalariales = 0.22): number {
  return Math.round(brut * (1 - tauxCotisationsSalariales) * 100) / 100;
}

export function calculateEmployerCost(brut: number, tauxCotisationsPatronales = 0.45): number {
  return Math.round(brut * (1 + tauxCotisationsPatronales) * 100) / 100;
}

export interface Salary {
  salaire_brut: number;
  salaire_net: number;
  cotisations_patronales: number;
}

export function calculateMonthlyPayroll(salaries: Salary[]): {
  totalNet: number;
  totalBrut: number;
  totalEmployerCost: number;
} {
  return salaries.reduce((acc, s) => ({
    totalNet: acc.totalNet + s.salaire_net,
    totalBrut: acc.totalBrut + s.salaire_brut,
    totalEmployerCost: acc.totalEmployerCost + s.salaire_brut + s.cotisations_patronales,
  }), { totalNet: 0, totalBrut: 0, totalEmployerCost: 0 });
}

export function calculateIncreasePercentage(oldSalary: number, newSalary: number): number {
  if (oldSalary === 0) return 0;
  return Math.round(((newSalary - oldSalary) / oldSalary) * 100 * 100) / 100;
}

export function projectAnnualSalary(monthlySalary: number, months = 12): number {
  return monthlySalary * months;
}

export function calculateRemainingLeave(acquired: number, taken: number, pending: number): number {
  return acquired - taken - pending;
}

export function calculateCPAcquisition(monthsWorked: number, rate = 2.5): number {
  return Math.min(monthsWorked * rate, 30);
}

export function countWorkingDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export interface AbsencePeriod {
  startDate: Date;
  endDate: Date;
}

export function hasOverlap(absence1: AbsencePeriod, absence2: AbsencePeriod): boolean {
  return absence1.startDate <= absence2.endDate && absence1.endDate >= absence2.startDate;
}

export function categorizeDocument(filename: string): string {
  const lowerName = filename.toLowerCase();
  if (lowerName.includes('contrat')) return 'contract';
  if (lowerName.includes('bulletin') || lowerName.includes('paie')) return 'payslip';
  if (lowerName.includes('attestation')) return 'certificate';
  if (lowerName.includes('cv') || lowerName.includes('curriculum')) return 'cv';
  if (lowerName.includes('formation')) return 'training';
  return 'other';
}

export function shouldArchive(
  documentType: string,
  uploadDate: Date,
  retentionYears: Record<string, number>
): boolean {
  const retentionPeriod = retentionYears[documentType] || 5;
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionPeriod);
  return uploadDate < cutoffDate;
}

export function calculateTurnoverRate(departures: number, averageHeadcount: number): number {
  if (averageHeadcount === 0) return 0;
  return Math.round((departures / averageHeadcount) * 100 * 100) / 100;
}

export function calculateAverageSeniority(employees: Array<{ hireDate: Date }>): number {
  if (employees.length === 0) return 0;
  const now = new Date();
  const totalYears = employees.reduce((sum, emp) => {
    const years = (now.getTime() - emp.hireDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return sum + years;
  }, 0);
  return Math.round(totalYears / employees.length * 10) / 10;
}

export function countByDepartment(
  employees: Array<{ department: string; isActive: boolean }>
): Record<string, number> {
  return employees
    .filter(e => e.isActive)
    .reduce((acc, emp) => {
      acc[emp.department] = (acc[emp.department] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
}
