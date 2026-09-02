import { describe, it, expect, vi, beforeEach } from 'vitest'
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
} from '@/lib/rhUtils'

describe('RH Salary Calculations', () => {
  describe('Salary Components', () => {
    it('should calculate net from gross salary', () => {
      expect(calculateNetFromGross(4500)).toBe(3510)
      expect(calculateNetFromGross(3000)).toBe(2340)
    })

    it('should calculate employer cost from gross salary', () => {
      expect(calculateEmployerCost(4500)).toBe(6525)
      expect(calculateEmployerCost(3000)).toBe(4350)
    })

    it('should calculate monthly total payroll', () => {
      const salaries = [
        { salaire_brut: 4500, salaire_net: 3510, cotisations_patronales: 2025 },
        { salaire_brut: 3000, salaire_net: 2340, cotisations_patronales: 1350 },
      ]
      const payroll = calculateMonthlyPayroll(salaries)
      expect(payroll.totalNet).toBe(5850)
      expect(payroll.totalBrut).toBe(7500)
      expect(payroll.totalEmployerCost).toBe(10875)
    })
  })

  describe('Salary Evolution', () => {
    it('should calculate salary increase percentage', () => {
      expect(calculateIncreasePercentage(3000, 3150)).toBe(5)
      expect(calculateIncreasePercentage(4000, 4200)).toBe(5)
      expect(calculateIncreasePercentage(4000, 4000)).toBe(0)
    })

    it('should project annual salary from monthly', () => {
      expect(projectAnnualSalary(4500)).toBe(54000)
      expect(projectAnnualSalary(4500, 13)).toBe(58500)
    })
  })
})

describe('RH Absence Management', () => {
  describe('Leave Balance Calculations', () => {
    it('should calculate remaining leave days', () => {
      expect(calculateRemainingLeave(25, 10, 5)).toBe(10)
      expect(calculateRemainingLeave(25, 20, 0)).toBe(5)
    })

    it('should calculate CP acquisition', () => {
      expect(calculateCPAcquisition(12)).toBe(30)
      expect(calculateCPAcquisition(6)).toBe(15)
      expect(calculateCPAcquisition(14)).toBe(30)
    })
  })

  describe('Absence Period Calculations', () => {
    it('should calculate working days between dates', () => {
      const monday = new Date('2026-02-02')
      const friday = new Date('2026-02-06')
      expect(countWorkingDays(monday, friday)).toBe(5)

      const sunday = new Date('2026-02-08')
      expect(countWorkingDays(monday, sunday)).toBe(5)
    })

    it('should detect overlapping absences', () => {
      const absence1 = { startDate: new Date('2026-02-01'), endDate: new Date('2026-02-10') }
      const absence2 = { startDate: new Date('2026-02-08'), endDate: new Date('2026-02-15') }
      const absence3 = { startDate: new Date('2026-02-20'), endDate: new Date('2026-02-25') }
      expect(hasOverlap(absence1, absence2)).toBe(true)
      expect(hasOverlap(absence1, absence3)).toBe(false)
    })
  })
})

describe('RH Document Management', () => {
  describe('Document Categories', () => {
    it('should categorize document by filename', () => {
      expect(categorizeDocument('Contrat_CDI_2026.pdf')).toBe('contract')
      expect(categorizeDocument('bulletin_paie_fevrier.pdf')).toBe('payslip')
      expect(categorizeDocument('attestation_employeur.pdf')).toBe('certificate')
      expect(categorizeDocument('CV_Marie_Dupont.pdf')).toBe('cv')
      expect(categorizeDocument('random_file.pdf')).toBe('other')
    })
  })

  describe('Document Retention', () => {
    it('should check if document should be archived', () => {
      const retentionRules = { payslip: 5, contract: 50, certificate: 2 }
      const oldDate = new Date('2020-01-01')
      const recentDate = new Date('2025-01-01')

      expect(shouldArchive('payslip', oldDate, retentionRules)).toBe(true)
      expect(shouldArchive('payslip', recentDate, retentionRules)).toBe(false)
      expect(shouldArchive('contract', oldDate, retentionRules)).toBe(false)
    })
  })
})

describe('RH KPI Calculations', () => {
  it('should calculate turnover rate', () => {
    expect(calculateTurnoverRate(3, 25)).toBe(12)
    expect(calculateTurnoverRate(0, 25)).toBe(0)
    expect(calculateTurnoverRate(5, 20)).toBe(25)
  })

  it('should calculate average seniority', () => {
    const employees = [
      { hireDate: new Date('2024-01-01') },
      { hireDate: new Date('2022-01-01') },
    ]
    const avgSeniority = calculateAverageSeniority(employees)
    expect(avgSeniority).toBeGreaterThan(2)
    expect(avgSeniority).toBeLessThan(4)
  })

  it('should calculate headcount by department', () => {
    const employees = [
      { department: 'Tech', isActive: true },
      { department: 'Tech', isActive: true },
      { department: 'Sales', isActive: true },
      { department: 'Sales', isActive: false },
    ]
    const counts = countByDepartment(employees)
    expect(counts['Tech']).toBe(2)
    expect(counts['Sales']).toBe(1)
  })
})
