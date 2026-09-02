import { describe, it, expect } from 'vitest'
import { getToolIcon, TABS } from '../JarvisUnifiedPanel.constants'

describe('JarvisUnifiedPanel.constants', () => {
  it('getToolIcon returns specific icons for known tools', () => {
    expect(getToolIcon('query_database')).toBeTruthy()
    expect(getToolIcon('send_email')).toBeTruthy()
    expect(getToolIcon('schedule_meeting')).toBe(getToolIcon('create_task'))
    expect(getToolIcon('search_knowledge_base')).toBeTruthy()
  })
  it('getToolIcon returns Zap as default for unknown tools', () => {
    const def = getToolIcon('__unknown__')
    expect(def).toBeTruthy()
    expect(def).toBe(getToolIcon('something-else'))
  })
  it('TABS contains 9 tabs with id+label+icon', () => {
    expect(TABS).toHaveLength(9)
    for (const t of TABS) {
      expect(t.id).toBeTruthy()
      expect(t.label).toBeTruthy()
      expect(t.icon).toBeTruthy()
    }
  })
  it('TABS includes expected ids', () => {
    const ids = TABS.map(t => t.id)
    expect(ids).toEqual(['chat','team','intelligence','workflows','predictions','actions','templates','analytics','settings'])
  })
})
