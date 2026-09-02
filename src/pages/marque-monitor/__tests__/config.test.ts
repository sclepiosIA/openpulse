import { describe, it, expect } from 'vitest'
import { SOURCE_CONFIG, SEVERITY_CONFIG } from '../config'

describe('marque-monitor/config', () => {
  it('SOURCE_CONFIG has all expected sources', () => {
    expect(Object.keys(SOURCE_CONFIG).sort()).toEqual(
      ['ai', 'api', 'email_sync', 'feedback', 'frontend', 'security'].sort()
    )
  })
  it('every SOURCE_CONFIG entry has label, icon, color', () => {
    for (const v of Object.values(SOURCE_CONFIG)) {
      expect(v.label).toBeTruthy()
      expect(v.icon).toBeTruthy()
      expect(v.color).toMatch(/bg-/)
    }
  })
  it('SEVERITY_CONFIG has all 4 levels', () => {
    expect(Object.keys(SEVERITY_CONFIG).sort()).toEqual(
      ['critical', 'error', 'info', 'warning'].sort()
    )
  })
  it('every SEVERITY_CONFIG entry has label and class', () => {
    for (const v of Object.values(SEVERITY_CONFIG)) {
      expect(v.label).toBeTruthy()
      expect(v.class).toMatch(/bg-/)
    }
  })
  it('critical uses red palette', () => {
    expect(SEVERITY_CONFIG.critical.class).toMatch(/red/)
  })
})
