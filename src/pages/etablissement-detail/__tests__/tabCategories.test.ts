import { describe, it, expect } from 'vitest'
import { TAB_CATEGORIES, TAB_TO_CATEGORY } from '../tabCategories'

describe('tabCategories', () => {
  it('exposes all expected categories', () => {
    const keys = Object.keys(TAB_CATEGORIES).sort()
    expect(keys).toContain('informations')
    expect(keys).toContain('contacts')
    expect(keys).toContain('communication')
    expect(keys).toContain('customer_success')
    expect(keys).toContain('documents')
    expect(keys).toContain('portail_client')
  })

  it('every category has label, icon, tabs', () => {
    for (const [, cat] of Object.entries(TAB_CATEGORIES)) {
      expect(cat.label).toBeTruthy()
      expect(cat.icon).toBeTruthy()
      expect(Array.isArray(cat.tabs)).toBe(true)
      expect(cat.tabs.length).toBeGreaterThan(0)
    }
  })

  it('productionOnly flag set on customer_success and statistiques', () => {
    expect(TAB_CATEGORIES.customer_success.productionOnly).toBe(true)
    expect(TAB_CATEGORIES.statistiques.productionOnly).toBe(true)
    expect(TAB_CATEGORIES.informations.productionOnly).toBeUndefined()
  })

  it('TAB_TO_CATEGORY maps every tab back to its parent', () => {
    expect(TAB_TO_CATEGORY.infos).toBe('informations')
    expect(TAB_TO_CATEGORY.emails).toBe('communication')
    expect(TAB_TO_CATEGORY.scoring).toBe('communication')
    expect(TAB_TO_CATEGORY.gantt).toBe('gestion')
    expect(TAB_TO_CATEGORY['csm-sante']).toBe('customer_success')
    expect(TAB_TO_CATEGORY['portail-client']).toBe('portail_client')
  })

  it('TAB_TO_CATEGORY covers all tabs across categories', () => {
    const allTabs = Object.values(TAB_CATEGORIES).flatMap(c => c.tabs)
    for (const t of allTabs) {
      expect(TAB_TO_CATEGORY[t]).toBeTruthy()
    }
  })

  it('unknown tab returns undefined', () => {
    expect(TAB_TO_CATEGORY['__nope__']).toBeUndefined()
  })
})
