import { describe, it, expect } from 'vitest'
import { formatPercentage, formatCompactNumber, truncate, getInitials, formatPhone } from '../formatterHelpers'

describe('formatterHelpers re-exports', () => {
  it('formatPercentage works', () => {
    expect(typeof formatPercentage(0.5)).toBe('string')
  })
  it('formatCompactNumber works', () => {
    expect(typeof formatCompactNumber(1500)).toBe('string')
  })
  it('truncate shortens long strings', () => {
    expect(truncate('hello world', 5).length).toBeLessThanOrEqual(8)
  })
  it('getInitials returns initials', () => {
    expect(getInitials('John Doe')).toMatch(/J/i)
  })
  it('formatPhone returns a string', () => {
    expect(typeof formatPhone('0612345678')).toBe('string')
  })
})
