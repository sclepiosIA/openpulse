import { describe, it, expect } from 'vitest'
import { getFrenchHolidays, isFrenchHoliday } from '../frenchHolidays'

describe('frenchHolidays', () => {
  it('returns 11 holidays for a year', () => {
    expect(getFrenchHolidays(2026)).toHaveLength(11)
  })

  it('includes fixed holidays', () => {
    const h = getFrenchHolidays(2026)
    expect(h[0]).toEqual(new Date(2026, 0, 1))
    expect(h[2]).toEqual(new Date(2026, 4, 1))
    expect(h[6]).toEqual(new Date(2026, 6, 14))
    expect(h[10]).toEqual(new Date(2026, 11, 25))
  })

  it('isFrenchHoliday returns true for New Year', () => {
    expect(isFrenchHoliday(new Date(2026, 0, 1))).toBe(true)
  })

  it('isFrenchHoliday returns false for an ordinary day', () => {
    expect(isFrenchHoliday(new Date(2026, 0, 2))).toBe(false)
  })

  it('computes Easter Monday correctly for 2026 (April 6)', () => {
    expect(isFrenchHoliday(new Date(2026, 3, 6))).toBe(true)
  })

  it('computes Easter Monday correctly for 2024 (April 1)', () => {
    expect(isFrenchHoliday(new Date(2024, 3, 1))).toBe(true)
  })

  it('Christmas is a holiday across years', () => {
    expect(isFrenchHoliday(new Date(2025, 11, 25))).toBe(true)
    expect(isFrenchHoliday(new Date(2027, 11, 25))).toBe(true)
  })
})
